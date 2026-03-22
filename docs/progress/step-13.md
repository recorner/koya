# Step 13 — Daraja M-Pesa + DFNS Custody Integration

**Status:** Complete  
**Date:** 2026-03-22  
**Depends On:** Step 12 — Wire Bria as BTC Delivery Provider

---

## Scope

Replace M-Pesa mocks with real Safaricom Daraja sandbox STK push and add DFNS as a third BTC delivery driver option (alongside mock and Bria). Add processed webhook dedup table for two-layer idempotency on all external callbacks. Add `daraja_requests` and `dfns_requests` tables for audit trails.

**Goal:** Production-ready payment and custody integrations with driver-selectable adapters, comprehensive idempotency, webhook signature verification, and unit tests for all new code.

---

## Architecture

### M-Pesa Daraja Integration

```
┌───────────────────────────────────────────────────────────────────┐
│                        PaymentsModule                             │
│                                                                   │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐   │
│  │  PaymentsController │  │  MPESA_ADAPTER (factory)         │   │
│  │                     │  │                                  │   │
│  │  POST /callback     │  │  MPESA_DRIVER env var:           │   │
│  │  • webhook dedup    │  │    "mock" → MockMpesaAdapter     │   │
│  │  • daraja_requests  │  │    "daraja" → DarajaMpesaAdapter │   │
│  │  • receipt extract  │  └──────────────────────────────────┘   │
│  └─────────────────────┘                                         │
└───────────────────────────────────────────────────────────────────┘
```

### DFNS Custody Integration

```
┌───────────────────────────────────────────────────────────────────┐
│                          DfnsModule                               │
│                                                                   │
│  ┌──────────────┐  ┌────────────────────────────────────────┐    │
│  │ DfnsService  │  │ DfnsController                         │    │
│  │              │  │                                        │    │
│  │ requestCust- │  │ POST /api/v1/dfns/webhook              │    │
│  │ odyMove()    │  │ • verify HMAC-SHA256 signature         │    │
│  │              │  │ • processed_webhooks dedup             │    │
│  │ verifyWebhoo │  │ • update dfns_requests + payouts       │    │
│  │ kSignature() │  │ • emit delivery.confirmed/failed       │    │
│  │              │  │                                        │    │
│  │ retry w/     │  └────────────────────────────────────────┘    │
│  │ backoff      │                                                │
│  └──────────────┘                                                │
│                                                                   │
│  ┌──────────────────────────┐                                    │
│  │ DfnsBtcDeliveryProvider  │ ◄── BTC_DELIVERY_DRIVER=dfns       │
│  │ implements BtcDelivery-  │     (ConversionModule factory)     │
│  │ Provider.send()          │                                    │
│  └──────────────────────────┘                                    │
└───────────────────────────────────────────────────────────────────┘
```

### Event Flow (DFNS)

```
ConversionService.processPaymentConfirmation()
  └─▶ DfnsBtcDeliveryProvider.send()
       └─▶ DfnsService.requestCustodyMove() → DFNS API
            └─▶ persists dfns_requests(status=PENDING)
                    ┊
           [async: DFNS executes transfer]
                    ┊
DfnsController.handleWebhook()
  ├─▶ verifyWebhookSignature()
  ├─▶ processed_webhooks INSERT ON CONFLICT (dedup)
  ├─▶ update dfns_requests(status=COMPLETED, dfnsTxId)
  ├─▶ update PayoutInstruction(status=CONFIRMED, txHash)
  └─▶ emit 'delivery.confirmed' event
       └─▶ ConversionService.onDeliveryConfirmed()
            └─▶ session → COMPLETED
```

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/api/src/providers/daraja-mpesa.adapter.ts` | Real Safaricom Daraja STK push adapter |
| `apps/api/src/dfns/dfns.service.ts` | DFNS HTTP client with retry, signature verification |
| `apps/api/src/dfns/dfns.controller.ts` | DFNS webhook handler (idempotent) |
| `apps/api/src/dfns/dfns.module.ts` | NestJS module for DFNS |
| `apps/api/src/providers/dfns-btc-delivery.provider.ts` | BtcDeliveryProvider implementation for DFNS |
| `apps/api/src/webhooks/processed-webhook.service.ts` | Shared webhook dedup service (INSERT ON CONFLICT) |
| `apps/api/src/webhooks/webhooks.module.ts` | NestJS module for webhook services |
| `apps/api/prisma/migrations/20260322100000_add_daraja_dfns_webhooks/migration.sql` | DB migration for 3 new tables |
| `apps/api/src/providers/__tests__/daraja-mpesa.adapter.spec.ts` | 6 unit tests |
| `apps/api/src/providers/__tests__/dfns-btc-delivery.provider.spec.ts` | 5 unit tests |
| `apps/api/src/dfns/__tests__/dfns.service.spec.ts` | 8 unit tests |
| `apps/api/src/dfns/__tests__/dfns.controller.spec.ts` | 7 unit tests |

## Files Modified

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Added DarajaRequest, DfnsRequest, ProcessedWebhook models |
| `apps/api/src/app/app.module.ts` | Import DfnsModule + WebhooksModule |
| `apps/api/src/payments/payments.module.ts` | Driver selection: MPESA_DRIVER (mock/daraja) via useFactory |
| `apps/api/src/payments/payments.controller.ts` | Two-layer webhook dedup, daraja_requests audit, receipt extraction |
| `apps/api/src/payments/mpesa.service.ts` | Added updateReceiptNumber() method |
| `apps/api/src/conversion/conversion.module.ts` | Import DfnsModule, add DfnsBtcDeliveryProvider to factory |
| `apps/api/src/conversion/conversion.service.ts` | DFNS driver path (async), delivery.confirmed/failed event listeners |
| `.env` | Added MPESA_DRIVER, MPESA_ENVIRONMENT, DFNS_API_URL, DFNS_APP_ID, DFNS_WALLET_ID, BTC_DELIVERY_DRIVER |

---

## New DB Tables

### daraja_requests
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| external_id | TEXT | UNIQUE |
| checkout_request_id | TEXT | UNIQUE |
| amount | BIGINT | NOT NULL |
| status | TEXT | DEFAULT 'PENDING' |
| raw_payload | JSONB | nullable |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | auto |

### dfns_requests
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| external_id | TEXT | UNIQUE |
| dfns_request_id | TEXT | UNIQUE, nullable |
| dfns_tx_id | TEXT | nullable |
| status | TEXT | DEFAULT 'PENDING' |
| raw_payload | JSONB | nullable |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | auto |

### processed_webhooks
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| source | TEXT | NOT NULL |
| external_id | TEXT | NOT NULL |
| processed_at | TIMESTAMP | DEFAULT NOW() |
| | | UNIQUE(source, external_id) |

---

## Environment Variables (New)

| Variable | Description | Default |
|----------|-------------|---------|
| `MPESA_DRIVER` | M-Pesa adapter: `mock` or `daraja` | `mock` |
| `MPESA_ENVIRONMENT` | Daraja environment: `sandbox` or `production` | `sandbox` |
| `DFNS_API_URL` | DFNS API base URL | `https://api.dfns.ninja/v2` |
| `DFNS_APP_ID` | DFNS application ID | — |
| `DFNS_WALLET_ID` | DFNS wallet ID for payouts | — |
| `DFNS_API_KEY` | DFNS API key | — |
| `DFNS_WEBHOOK_SECRET` | DFNS webhook HMAC secret | — |
| `DFNS_WEBHOOK_URL` | DFNS callback URL | — |
| `BTC_DELIVERY_DRIVER` | BTC delivery driver: `mock`, `bria`, or `dfns` | `mock` |

---

## Verification Evidence

### Unit Tests (26 new, 232 total — all passing)

```
PASS  apps/api/src/providers/__tests__/daraja-mpesa.adapter.spec.ts
  DarajaMpesaAdapter
    ✓ should initiate STK push successfully
    ✓ should cache OAuth token
    ✓ should return failure on non-zero ResponseCode
    ✓ should return failure on HTTP error
    ✓ should normalize phone numbers correctly
    ✓ should use production URL when MPESA_ENVIRONMENT is production

PASS  apps/api/src/providers/__tests__/dfns-btc-delivery.provider.spec.ts
  DfnsBtcDeliveryProvider
    ✓ should submit custody move with correct params
    ✓ should build correct externalId from referenceCode
    ✓ should handle existing request (idempotent)
    ✓ should return failure on error
    ✓ should return failure on network error

PASS  apps/api/src/dfns/__tests__/dfns.service.spec.ts
  DfnsService
    requestCustodyMove
      ✓ should submit custody move and persist request
      ✓ should return existing request for duplicate externalId
      ✓ should throw on permanent API error
      ✓ should handle 409 conflict as idempotent
    verifyWebhookSignature
      ✓ should verify valid HMAC signature
      ✓ should reject invalid signature
      ✓ should reject when no secret configured
    updateRequestStatus
      ✓ should update status and txId

PASS  apps/api/src/dfns/__tests__/dfns.controller.spec.ts
  DfnsController
    ✓ should reject invalid signature
    ✓ should ignore webhook without externalId
    ✓ should return already_processed for duplicate webhooks
    ✓ should throw 404 for unknown externalId
    ✓ should process successful webhook and emit delivery.confirmed
    ✓ should skip already confirmed payouts (idempotent)
    ✓ should process failed webhook and emit delivery.failed

Test Suites: 18 passed, 18 total
Tests:       232 passed, 232 total
```

### Lint
```
✔ Successfully ran target lint for project api (0 errors, 4 warnings)
```

### Build
```
✔ Successfully ran target build for project api and 2 tasks it depends on
```

---

## Idempotency Contract

| Layer | Component | Key | Behavior |
|-------|-----------|-----|----------|
| 1 | ProcessedWebhookService | (source, externalId) | INSERT ON CONFLICT DO NOTHING — returns false if duplicate |
| 2 | MpesaService.handleCallback | checkoutRequestId | Checks PaymentInstruction status, skips CONFIRMED/FAILED |
| 2 | DfnsController.handleSuccess | PayoutInstruction status | Skips if already CONFIRMED |
| 3 | DarajaRequest | externalId UNIQUE | DB constraint prevents duplicate daraja_requests |
| 3 | DfnsRequest | externalId UNIQUE | DB constraint prevents duplicate dfns_requests |
| 4 | DfnsService.requestCustodyMove | externalId (DB lookup) | Returns existing request if duplicate externalId |
| 4 | DfnsBtcDeliveryProvider | externalId via DfnsService | DFNS API 409 → treated as success |

---

## Security Checklist

- [x] DFNS webhook signature verified with HMAC-SHA256 + constant-time comparison
- [x] Webhook without valid signature rejected with 401
- [x] No secrets in source code — all via env vars
- [x] Daraja OAuth token cached, never logged
- [x] DFNS retry logic distinguishes transient (5xx/429) vs permanent (4xx) errors
- [x] Webhook dedup prevents replay attacks
- [x] `externalId` format is safe (`koya:conversion:<alphanum>`)

---

## Driver Selection Matrix

| MPESA_DRIVER | Behavior |
|-------------|----------|
| `mock` (default) | MockMpesaAdapter — instant success, no network calls |
| `daraja` | DarajaMpesaAdapter — real Safaricom Daraja sandbox/production STK push |

| BTC_DELIVERY_DRIVER | Behavior |
|---------------------|----------|
| `mock` (default) | MockBtcDeliveryProvider — instant txHash, sync completion |
| `bria` | BriaBtcDeliveryProvider — Bria gRPC payout, async via event consumer |
| `dfns` | DfnsBtcDeliveryProvider — DFNS HTTP custody move, async via webhook |

---

## How to Activate

### Daraja (M-Pesa)
```bash
# In .env:
MPESA_DRIVER=daraja
MPESA_ENVIRONMENT=sandbox   # or "production"
MPESA_CONSUMER_KEY=<your-daraja-key>
MPESA_CONSUMER_SECRET=<your-daraja-secret>
MPESA_PASSKEY=<your-passkey>
MPESA_SHORTCODE=<your-shortcode>
MPESA_CALLBACK_URL=https://<your-domain>/api/v1/payments/mpesa/callback
```

### DFNS Custody
```bash
# In .env:
BTC_DELIVERY_DRIVER=dfns
DFNS_API_URL=https://api.dfns.ninja/v2
DFNS_API_KEY=<your-dfns-api-key>
DFNS_APP_ID=<your-dfns-app-id>
DFNS_WALLET_ID=<your-dfns-wallet-id>
DFNS_WEBHOOK_SECRET=<your-webhook-secret>
DFNS_WEBHOOK_URL=https://<your-domain>/api/v1/dfns/webhook
```

---

## Next Steps

- [ ] Test with real Daraja sandbox credentials (ngrok for callbacks)
- [ ] Test with real DFNS sandbox credentials
- [ ] Add integration tests (requires sandbox connectivity)
- [ ] Wire DFNS + Bria together (Pattern A: DFNS broadcasts, Bria records)
- [ ] Add structured logging/metrics for payment and custody lifecycle
- [ ] Implement Daraja Transaction Status API query for manual verification
