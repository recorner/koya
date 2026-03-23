# Step 14 — DFNS SDK + Bria PSBT Signing Engine

**Status:** Complete  
**Date:** 2026-03-23  
**Depends On:** Step 13 — Daraja M-Pesa + DFNS Custody Integration

---

## Scope

Build `libs/dfns-sdk` as a standalone TypeScript library for DFNS API interactions, then wire the Bria→DFNS→Bria PSBT signing flow so that when `BTC_DELIVERY_DRIVER=dfns` is set, payouts go through Bria for UTXO management and PSBT building while DFNS handles external signing.

**Goal:** Production-ready PSBT signing pipeline with mTLS support for staging/prod and API-key fallback for sandbox. Idempotent at every step, append-only audit trail via `payout_psbts` table.

---

## Architecture

### PSBT Signing Flow (driver=dfns)

```
DfnsBtcDeliveryProvider.send()
  → BriaClientService.submitPayout()     # Submit to Bria queue

BriaEventConsumer (payout_committed)
  → BriaClientService.getBatch(batchId)  # Get unsigned PSBT
  → PsbtSigningService
    → prisma.payoutPsbt.create()         # Store metadata
    → DFNSClient.requestSignPsbt()       # Send to DFNS for signing
    → BriaClientService.submitSignedPsbt() # Return signed PSBT to Bria

BriaEventConsumer (payout_settled)
  → PsbtSigningService.markSettled()     # Update audit record
```

### Key Design Decisions

1. **DfnsBtcDeliveryProvider** no longer calls DFNS directly — it submits payouts to Bria. DFNS signing is handled asynchronously by the event consumer.
2. **PsbtSigningService** orchestrates the full signing flow with idempotency checks at every DB write.
3. **DFNSClient** in `libs/dfns-sdk` handles mTLS via Node.js `https.Agent`, exponential backoff + jitter for transient errors, and HMAC-SHA256 webhook signature verification.
4. **BriaEventConsumer** subscribes with `augment: true` to get `batch_id` from `payout_committed` events.

---

## Changes

### New: `libs/dfns-sdk/` (standalone library)

| File | Purpose |
|------|---------|
| `dfns.client.ts` | `DFNSClient` class — `requestSignPsbt()`, `getRequestStatus()`, `verifyWebhookSignature()`, `parseAndVerifyWebhook()` |
| `dfns.types.ts` | All interfaces — `DfnsClientOptions`, `DfnsMTlsOptions`, `SignPsbtParams`, `SignPsbtResult`, `WebhookPayload` |
| `dfns.errors.ts` | `DfnsTransientError` (5xx, 429, network) and `DfnsPermanentError` (4xx) |
| `dfns.retry.ts` | `retryWithBackoff()` with exponential backoff + jitter, only retries `DfnsTransientError` |
| `dfns.signature.ts` | `verifyHmacSignature()` (constant-time HMAC-SHA256), `computeHmacSignature()` |
| `__tests__/` | 29 tests across 3 spec files |

### New: `apps/api/src/conversion/psbt-signing.service.ts`

Orchestrates: `getBatch → payoutPsbt.create → requestSignPsbt → submitSignedPsbt`. Handles idempotency by checking existing `PayoutPsbt` records before proceeding.

### New: Prisma `PayoutPsbt` model

```sql
CREATE TABLE payout_psbts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE NOT NULL,
  psbt_base64 TEXT,
  psbt_status TEXT NOT NULL DEFAULT 'unsigned',
  psbt_id TEXT,
  dfns_request_id TEXT,
  signed_psbt_base64 TEXT,
  txid TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Modified: `apps/api/src/conversion/bria-event-consumer.service.ts`

- Now subscribes for both `bria` and `dfns` drivers
- Subscribes with `augment: true` for `batch_id` in `payout_committed` events
- New `handlePayoutCommitted()` handler calls `PsbtSigningService`
- `handlePayoutSettled()` calls `psbtSigningService.markSettled()`

### Modified: `apps/api/src/providers/dfns-btc-delivery.provider.ts`

- Depends on `BriaClientService + ConfigService` instead of `DfnsService`
- `send()` calls `briaClient.submitPayout()` — DFNS signing happens async via events

### Modified: `apps/api/src/dfns/dfns.service.ts`

- Uses `DFNSClient` from `@koya/dfns-sdk` instead of raw `fetch`
- mTLS support via cert file paths from env vars
- Webhook verification delegates to SDK

### Modified: `libs/bria-adapter/`

- Added `getBatch(id)` to `BriaClientService`
- Added `GetBatchResult` type

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BTC_DELIVERY_DRIVER` | Set to `dfns` to enable PSBT signing flow | Yes |
| `DFNS_API_URL` | DFNS API base URL | Yes |
| `DFNS_APP_ID` | DFNS application ID | Yes |
| `DFNS_WALLET_ID` | DFNS wallet ID | Yes |
| `DFNS_API_KEY` | API key (sandbox fallback) | For sandbox |
| `DFNS_MTLS_CERT` | Path to PEM client cert | For staging/prod |
| `DFNS_MTLS_KEY` | Path to PEM client key | For staging/prod |
| `DFNS_MTLS_CA` | Path to PEM CA cert | Optional |
| `DFNS_WEBHOOK_SECRET` | HMAC secret for webhook verification | Yes |
| `BRIA_XPUB_REF` | Bria xpub reference for signed PSBT submission | Yes |
| `BRIA_WALLET_NAME` | Bria wallet name for payout submission | Yes |
| `BRIA_PAYOUT_QUEUE_NAME` | Bria payout queue name | Yes |

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `libs/dfns-sdk` | 29 | ✅ |
| `apps/api` unit tests | 239 | ✅ |
| API lint | 0 errors, 4 warnings | ✅ |
| dfns-sdk lint | 0 errors, 0 warnings | ✅ |
| TypeScript typecheck | 0 errors | ✅ |

---

## Security

- **mTLS** required in staging/production — cert/key loaded from file paths, never from env vars directly
- **HMAC-SHA256** webhook verification with constant-time comparison (`crypto.timingSafeEqual`)
- **No secrets in code** — all credentials from environment variables
- **Idempotency keys** at every external interaction (DFNS `externalId`, Bria `externalId`, DB unique constraints)
- **Transient vs permanent error classification** — only transient errors (5xx, 429, network) are retried
