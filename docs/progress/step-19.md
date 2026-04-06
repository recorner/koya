# Step 19 — Full E2E Engine Test: Daraja + Bria + Bitcoin

**Status:** Complete  
**Date:** 2026-04-05  
**Depends On:** Step 18 — Full Cold Start from Zero

---

## Scope

Execute the comprehensive test plan from `engine.md`: real Daraja sandbox STK push,
Bria custody payouts, bitcoind regtest signing, on-chain settlement, and full
conversion state machine traversal from QUOTE through COMPLETED.

---

## What Was Accomplished

### Infrastructure Setup
- Bria 0.1.131 + PostgreSQL 14 + bitcoind v27.0 (regtest) + electrs on GCP VM
- Bria wallet funded with ~150 BTC from regtest mining
- DFNS workaround: `BTC_DELIVERY_DRIVER=bria` with bitcoind as signer (DFNS doesn't support testnet4)

### Bugs Found & Fixed

**1. Bria SQL Batch Bug (Critical)**
- PostgreSQL 16 stricter parameter parsing broke Bria's `reserve_utxos_in_batch` query
- Error: `trailing junk after parameter at or near "$3WHERE"`
- Fix: Downgraded `bria-pg` from `postgres:16-alpine` → `postgres:14-alpine`

**2. BriaEventConsumer gRPC `this` Binding (Critical)**
- `subscribeAll` method extracted from gRPC client lost `this` context
- Error: `TypeError: Cannot read properties of undefined (reading 'checkMetadataAndOptions')`
- Fix: `streamFn(req, metadata)` → `streamFn.call(this.client, req, metadata)` in
  `libs/bria-adapter/src/bria-client.service.ts:253`

### Test Results — All Pass

| Test | Result | Key Evidence |
|------|--------|-------------|
| T1: Happy path (KES 1000 → BTC) | ✅ PASS | KYA-D96DD151 → COMPLETED, txId=eb4278... |
| T2: Duplicate callback idempotency | ✅ PASS | State unchanged, no duplicate records |
| T3: Failure/timeout path | ✅ PASS | KYA-6916A988 stays PAYMENT_PENDING, FAILED payment |
| Reconciliation | ✅ PASS | Completed==PayoutsConfirmed, 0 orphans |

### Full Happy Path Flow (T1)

```
Quote (KES 1000, rate 0.000000114289)
  → Session KYA-D96DD151
    → Identity (guest T1RACE77788, compliance passed)
      → Payout details (bcrt1qggxg4z7...)
        → STK Push (checkout ws_CO_0504202621...)
          → Success callback (receipt T1FINAL...)
            → Payment CONFIRMED
              → Bria payout submitted (c211f34f...)
                → Batch created (360a2008...)
                  → Bitcoin broadcast (txId eb427840...)
                    → On-chain confirmed (1 block, 11252 sats)
                      → BriaEventConsumer detects payout_settled
                        → Conversion → COMPLETED ✅
```

### Files Changed

| File | Change |
|------|--------|
| `docker-compose.yml` | Bria image → `0.1.131`, Bria PG → `postgres:14-alpine` |
| `docker/bria.env` | Updated BRIA_API_KEY for fresh Bria bootstrap |
| `libs/bria-adapter/src/bria-client.service.ts` | Fixed `subscribeAll` `this` binding |
| `.env` | Updated BRIA_API_KEY |
| AWS Secrets Manager `/koya/bria/apiKey` | Updated to match new Bria instance |

### Evidence

- Full test report: `tmp/test-evidence/e2e-test-report.md`
- Completed conversion: KYA-D96DD151
- On-chain tx: `eb427840bf3b2c9c348bcda9e0d94ac7137344e8b04afb4a64e880a3b2376b0b`
