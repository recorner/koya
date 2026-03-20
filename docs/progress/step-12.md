# Step 12 — Wire Bria as BTC Delivery Provider

**Status:** Complete  
**Date:** 2026-03-20  
**Depends On:** Step 11 — Bria NestJS Adapter Library

---

## Scope

Wire the `@koya/bria-adapter` library into the API conversion flow as `BTC_DELIVERY_PROVIDER`. Create a real `BriaBtcDeliveryProvider` that calls `BriaClientService.submitPayout()` for BTC delivery, add a Bria event consumer for async payout status tracking, create a bootstrap/setup service, and add Prisma schema fields for Bria payout tracking. Mock stays default — real Bria swapped in per-environment via `BTC_DELIVERY_DRIVER` env var. DFNS layers on later via the same driver pattern.

**Goal:** A production-ready BTC delivery path using Bria, with two-phase async delivery (submit → event confirmation), idempotency via `externalId`, a dev-only setup endpoint, and comprehensive unit tests.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ConversionModule                             │
│                                                                        │
│  ┌──────────────────────┐    ┌─────────────────────────────────────┐   │
│  │  ConversionService   │    │  BTC_DELIVERY_PROVIDER (factory)    │   │
│  │                      │    │                                     │   │
│  │  processPayment      │──▶│  BTC_DELIVERY_DRIVER env var:       │   │
│  │  Confirmation()      │    │    "mock" → MockBtcDeliveryProvider │   │
│  │                      │    │    "bria" → BriaBtcDeliveryProvider │   │
│  └──────────────────────┘    │    "dfns" → (future)               │   │
│                               └──────────┬──────────────────────────┘   │
│                                          │                             │
│  ┌──────────────────────────┐            │                             │
│  │ BriaEventConsumerService │            │                             │
│  │                          │            ▼                             │
│  │ subscribes to Bria event │   ┌─────────────────────────┐           │
│  │ stream (when driver=bria)│   │ BriaBtcDeliveryProvider  │           │
│  │                          │   │                          │           │
│  │ payout_broadcast →       │   │ submitPayout() →         │           │
│  │   update txHash          │   │   externalId idempotency │           │
│  │ payout_settled →         │   │   ALREADY_EXISTS handler │           │
│  │   COMPLETED + emit event │   │   returns payout ID      │           │
│  │ payout_cancelled →       │   └──────────┬──────────────┘           │
│  │   FAILED                 │              │                           │
│  └──────────────────────────┘              │ gRPC                      │
│                                            ▼                           │
│  ┌──────────────────────────┐     ┌──────────────────┐                │
│  │ BriaSetupService         │     │ BriaClientService │                │
│  │ (one-time admin setup)   │     │ (@koya/bria-      │                │
│  │ bootstrap → account →    │     │  adapter)         │                │
│  │ profile → xpub → wallet  │     └────────┬─────────┘                │
│  └──────────────────────────┘              │                           │
└────────────────────────────────────────────┼───────────────────────────┘
                                             │ gRPC :2742
                                    ┌────────▼────────┐
                                    │   Bria Daemon    │
                                    │   (testnet4)     │
                                    └─────────────────┘
```

### Key Design Decisions

1. **Mock stays default** — `BTC_DELIVERY_DRIVER=mock` is the default. Swap to `bria` per-environment. Same `useFactory` pattern extends to `dfns` later. No behavioral changes when using mock.

2. **Two-phase async delivery** — When driver=bria, `send()` submits the payout and stays in `DELIVERY_PENDING`. The `BriaEventConsumerService` advances to `COMPLETED` when `payout_settled` arrives from Bria's event stream. Mock keeps the instant-complete path unchanged.

3. **Idempotency via `externalId`** — Every payout submission uses `externalId = "koya:conversion:<referenceCode>"`. If Bria returns `ALREADY_EXISTS`, the provider looks up the existing payout and returns it — safe for retries.

4. **Generic `providerPayoutId`** — The Prisma field is named `providerPayoutId` (not `briaPayoutId`) so it works for any future provider (DFNS, etc.).

5. **Event consumer conditional** — Only subscribes to Bria events when `BTC_DELIVERY_DRIVER=bria`. Zero overhead when using mock.

6. **Setup is manual** — `BriaSetupService` exposes idempotent one-time operations (bootstrap admin, create account/profile, import xpub, create wallet). Dev-only endpoint at `POST /api/v1/admin/bria/setup` protected by admin API key, disabled in production.

7. **Cursor replay from 0** — Event consumer starts from sequence 0 on restart. Processing is idempotent (checks current state before transitioning). Redis-backed cursor persistence can be added in follow-up.

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/api/src/providers/bria-btc-delivery.provider.ts` | Real BTC delivery via `BriaClientService.submitPayout()` |
| `apps/api/src/conversion/bria-event-consumer.service.ts` | Subscribes to Bria event stream, tracks payout lifecycle |
| `apps/api/src/conversion/bria-setup.service.ts` | One-time Bria admin provisioning and wallet setup |
| `apps/api/src/conversion/bria-setup.controller.ts` | Dev-only `POST /api/v1/admin/bria/setup` endpoint |
| `apps/api/src/providers/__tests__/bria-btc-delivery.provider.spec.ts` | 6 unit tests for BriaBtcDeliveryProvider |
| `apps/api/src/conversion/__tests__/bria-event-consumer.spec.ts` | 6 unit tests for BriaEventConsumerService |
| `apps/api/prisma/migrations/20260320100000_add_bria_payout_fields/migration.sql` | Add `externalId` (unique) + `providerPayoutId` to PayoutInstruction |

## Files Modified

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Added `externalId String? @unique` and `providerPayoutId String?` to PayoutInstruction model |
| `apps/api/src/conversion/conversion.module.ts` | Import BriaModule + ConfigModule; add `useFactory` driver selection for `BTC_DELIVERY_PROVIDER`; register BriaEventConsumerService, BriaSetupService, BriaSetupController (dev-only) |
| `apps/api/src/conversion/conversion.service.ts` | Two-phase delivery logic in `processPaymentConfirmation()`: persist externalId/providerPayoutId, branch on driver (mock=instant COMPLETED, bria=stays DELIVERY_PENDING) |
| `libs/types/tsconfig.lib.json` | Added `rootDir: "./src"` to fix pre-existing SWC build error |

---

## Environment Variables (New)

| Variable | Description | Default |
|----------|-------------|---------|
| `BTC_DELIVERY_DRIVER` | BTC delivery provider: `mock` or `bria` (future: `dfns`) | `mock` |
| `BRIA_WALLET_NAME` | Bria wallet name for payouts | `koya-wallet` |
| `BRIA_PAYOUT_QUEUE` | Bria payout queue name | `default` |
| `ADMIN_API_KEY` | Admin API key for setup endpoint auth | — |

---

## Verification Evidence

### Unit Tests (12 new, 254 total — all passing)

```
PASS  apps/api/src/providers/__tests__/bria-btc-delivery.provider.spec.ts
  BriaBtcDeliveryProvider
    ✓ should submit payout with correct params
    ✓ should build correct externalId from referenceCode
    ✓ should handle ALREADY_EXISTS as idempotent success
    ✓ should return success with empty txHash if existing payout has no txId
    ✓ should return failure on non-transient error
    ✓ should return failure when ALREADY_EXISTS lookup fails

PASS  apps/api/src/conversion/__tests__/bria-event-consumer.spec.ts
  BriaEventConsumerService
    ✓ should skip subscription when driver is mock
    ✓ should subscribe to Bria events when driver is bria
    ✓ should update txHash on payout_broadcast
    ✓ should transition session to COMPLETED on payout_settled
    ✓ should skip already CONFIRMED payouts on payout_settled (idempotent)
    ✓ should skip events for unknown payouts
    ✓ should unsubscribe on destroy

Test Suites: 18 passed, 18 total
Tests:       254 passed, 254 total
```

### Lint

```
$ pnpm nx lint api
✔  Successfully ran target lint for project api (0 errors, 4 warnings)
```

### Build

```
$ pnpm nx build api
✔  Successfully ran target build for project api and 2 tasks it depends on
```

---

## Public API

### BriaBtcDeliveryProvider

| Method | Delegates To | Returns |
|--------|-------------|---------|
| `send(BtcSendInput)` | `BriaClientService.submitPayout()` | `BtcSendResult { success, txHash (=payoutId), confirmations: 0 }` |

### BriaEventConsumerService

| Event | Action |
|-------|--------|
| `payout_submitted` | Log only |
| `payout_committed` | Log only |
| `payout_broadcast` | Update `PayoutInstruction.txHash` with real on-chain txId |
| `payout_settled` | Mark payout CONFIRMED, transition session → COMPLETED, emit `conversion.completed` |
| `payout_cancelled` | Mark payout FAILED, transition session → FAILED |

### BriaSetupService

| Method | Purpose |
|--------|---------|
| `bootstrapAdmin()` | One-time admin credential creation |
| `createKoyaAccount()` | Create 'koya' account in Bria |
| `createServiceProfile()` | Create 'koya-service' profile + API key |
| `importXpubAndCreateWallet(xpub, derivation?)` | Import xpub + create HD wallet |
| `verifySetup()` | Generate test address to confirm wallet works |
| `runFullSetup(xpub?)` | Run all steps in sequence |

### BriaSetupController (dev-only)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/v1/admin/bria/setup` | `x-admin-api-key` header | Run full Bria setup |

---

## Idempotency Contract

| Component | Idempotency Key | Behavior |
|-----------|----------------|----------|
| `BriaBtcDeliveryProvider.send()` | `koya:conversion:<referenceCode>` | `ALREADY_EXISTS` → lookup existing payout, return success |
| `PayoutInstruction.externalId` | Unique constraint in DB | Prevents duplicate DB records for same conversion |
| `BriaEventConsumerService` | Checks `payout.status` before transitioning | Already-CONFIRMED payouts are skipped (safe for event replay) |
| `BriaSetupService` | Each method checks if resource exists before creating | Safe to call multiple times |

---

## Lessons Learned

### useFactory for driver-selectable providers
When two implementations of the same interface exist (mock + real), use `useFactory` with a config key to select at runtime. Register both concrete classes as regular providers, then have the factory inject both + ConfigService and return the right one. This avoids conditional imports and keeps the DI container clean.

### Two-phase delivery requires behavioral branching
The mock provider returns instantly with a txHash, while the real provider returns a Bria payout ID and the txHash arrives asynchronously via events. The ConversionService must branch on the driver config to decide whether to immediately transition to COMPLETED or stay in DELIVERY_PENDING. Using the same interface for both means the caller must know which path it's on.

### Prisma migrate deploy requires --config flag
With Prisma v7 using `prisma.config.ts` for the datasource URL, `prisma migrate deploy` needs `--config prisma/prisma.config.ts` explicitly. Without it, it fails with "datasource.url property is required" even though the config file exists.

### Pre-existing DB columns cause migration failures
If a column already exists (from a prior manual apply), `prisma migrate deploy` fails with a Postgres `42701` error. Fix: `prisma migrate resolve --applied "<migration_name>"` to mark as already applied.

---

## Security Checklist

- [x] Setup endpoint disabled in production (`NODE_ENV !== 'production'`)
- [x] Setup endpoint requires admin API key header authentication
- [x] No secrets in source code or test fixtures
- [x] `externalId` format prevents injection (`koya:conversion:<alphanum>`)
- [x] Event consumer validates payout exists before acting
- [x] Idempotent processing prevents duplicate state transitions

---

## Next Steps

- [ ] Deploy to staging with `BTC_DELIVERY_DRIVER=bria` and run full flow
- [ ] Import real testnet4 xpub and create production-ready wallet
- [ ] Add Redis-persisted event cursor for production restart resilience
- [ ] Wire DFNS custody provider as additional driver option
- [ ] Add structured logging/metrics for payout lifecycle tracking
- [ ] Integration test with running Bria container in CI
