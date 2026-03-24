# Step 15 — Engine: Cursor Persistence, Ops, Retention, CI

**Status:** Complete  
**Date:** 2026-03-24  
**Depends On:** Step 14 — DFNS SDK + Bria PSBT Signing Engine

---

## Scope

Add persistent Redis cursor for the Bria event consumer so it resumes from the last-processed sequence on restart. Build operational jobs for PSBT data retention and Koya↔Bria ledger reconciliation. Add a DFNS health check endpoint for orchestration monitoring. Create a nightly CI workflow skeleton and mTLS operations documentation.

**Goal:** Production-ready event resilience, compliance-oriented data retention, ledger reconciliation with alerting, and ops tooling for DFNS mTLS lifecycle management.

---

## Architecture

### Redis Cursor Persistence

```
BriaEventConsumerService.onModuleInit()
  → RedisCursorStore.getCursor('bria_event_consumer')  # Load last offset
  → BriaClientService.subscribeAll({ afterSequence: cursor })

BriaEventConsumerService.handleEvent(event)
  → processEvent(payload, event)                        # Handle business logic
  → RedisCursorStore.setCursor('bria_event_consumer', event.sequence)  # Persist
```

**Key:** `koya:cursor:bria_event_consumer` in Redis. Uses existing `REDIS_CLIENT` injection from `CacheModule` — no separate connection.

### Operational Jobs

```
┌──────────────────────────────────────────────────────────────────┐
│                           OpsModule                              │
│                                                                  │
│  ┌────────────────────────┐  ┌─────────────────────────────┐    │
│  │ PsbtRetentionService   │  │ ReconciliationService        │    │
│  │                        │  │                              │    │
│  │ @Cron(EVERY_DAY_AT_2AM)│  │ @Cron(EVERY_DAY_AT_3AM)     │    │
│  │                        │  │                              │    │
│  │ • Find settled/failed  │  │ • Query confirmed payouts   │    │
│  │   PSBTs >90 days old   │  │   from last 24 hours        │    │
│  │ • Mark psbtBase64 =    │  │ • For each: getPayout from  │    │
│  │   '[archived]'         │  │   Bria by externalId        │    │
│  │ • Set psbtStatus =     │  │ • Compare sats amounts      │    │
│  │   'archived'           │  │ • Log WARNING if delta > 0  │    │
│  │ • Keep txid + metadata │  │ • Log CRITICAL if > 1000    │    │
│  └────────────────────────┘  └─────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### DFNS Health Check

```
GET /internal/health/dfns
  → DfnsService.healthcheck()
    → DFNSClient.healthcheck()
      ├─ mTLS configured?  → TLS socket handshake (2s timeout)
      └─ API-key only?     → GET /health probe (2s timeout)
    → { status: "ok"|"unhealthy", latencyMs, mTls }
```

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/api/src/conversion/redis-cursor.store.ts` | `RedisCursorStore` service — `getCursor()`, `setCursor()` with `koya:cursor:` prefix |
| `apps/api/src/ops/ops.module.ts` | NestJS module wiring retention + reconciliation cron jobs |
| `apps/api/src/ops/psbt-retention.service.ts` | Daily cron: archives `payout_psbts` where `psbtStatus ∈ {settled, failed}` and `updatedAt < 90 days ago` |
| `apps/api/src/ops/reconciliation.service.ts` | Daily cron: compares Koya `PayoutInstruction` records against Bria payouts by `externalId` |
| `apps/api/src/dfns/dfns-health.controller.ts` | `GET /internal/health/dfns` — mTLS handshake or API probe |
| `.github/workflows/nightly-dfns-integration.yml` | GitHub Actions nightly CI workflow for DFNS integration tests |
| `docs/deployment/dfns-mtls.md` | mTLS setup, cert rotation, troubleshooting runbook, simulation curl commands |
| `apps/api/src/conversion/__tests__/redis-cursor.store.spec.ts` | 4 unit tests |
| `apps/api/src/ops/__tests__/psbt-retention.service.spec.ts` | 2 unit tests |
| `apps/api/src/ops/__tests__/reconciliation.service.spec.ts` | 4 unit tests |
| `apps/api/src/dfns/__tests__/dfns-health.controller.spec.ts` | 2 unit tests |

## Files Modified

| File | Change |
|------|--------|
| `apps/api/src/conversion/bria-event-consumer.service.ts` | Inject `RedisCursorStore`, `onModuleInit` now async — loads cursor before subscribing, saves cursor after each event via `setCursor()` |
| `apps/api/src/conversion/conversion.module.ts` | Register `RedisCursorStore` as provider |
| `apps/api/src/app/app.module.ts` | Import `OpsModule` |
| `apps/api/src/dfns/dfns.module.ts` | Add `DfnsHealthController` to controllers array |
| `apps/api/src/dfns/dfns.service.ts` | Add `healthcheck()` method delegating to SDK |
| `libs/dfns-sdk/src/dfns.client.ts` | Add `healthcheck()` — mTLS: TLS socket handshake; API-key: HTTP GET `/health`; both with 2s timeout |
| `apps/api/src/conversion/__tests__/bria-event-consumer.spec.ts` | Add `RedisCursorStore` mock, `await` async `onModuleInit()`, add 2 cursor-specific tests |

---

## Key Design Decisions

1. **Cursor store reuses existing ioredis** — injected via `REDIS_CLIENT` token from the global `CacheModule`. No new Redis connection or dependency.
2. **Cursor saved after every event** — even on handler failure, to prevent infinite retry loops on poison events. This trades at-least-once for at-most-once on individual events.
3. **Retention marks `psbtBase64='[archived]'`** — schema defines `psbtBase64` as required `String`, so we can't NULL it. The marker value distinguishes archived from unprocessed. S3 pre-archival upload is a TODO.
4. **Reconciliation iterates per-payout** — uses `BriaClientService.getPayout({ externalId })`. For high-volume, a batch listing API would be more efficient.
5. **Health check separates mTLS vs API-key paths** — mTLS does a raw TLS socket handshake to validate cert validity; API-key mode does a lightweight HTTP GET.

---

## Nightly CI Workflow

| Step | Action |
|------|--------|
| 1 | Checkout + configure AWS credentials via OIDC role |
| 2 | Fetch DFNS secrets from AWS Secrets Manager → `docker/secrets/` |
| 3 | `pnpm install --frozen-lockfile` |
| 4 | `docker compose up -d --build --wait` |
| 5 | Wait for API health (`/api/v1/health`) |
| 6 | Run DFNS integration tests (`pnpm nx test api --testPathPattern="dfns.*integration"`) |
| 7 | Probe DFNS health endpoint (`/internal/health/dfns`) |
| 8 | Upload logs as artifact |
| 9 | Tear down stack (`docker compose down -v`) |

Trigger: `cron: '0 3 * * *'` (03:00 UTC daily) + `workflow_dispatch` for manual runs.

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `apps/api` (all) | 301 | ✅ |
| `libs/bria-adapter` | 23 | ✅ |
| `libs/dfns-sdk` | 29 | ✅ |
| API lint | 0 errors, 4 warnings | ✅ |

---

## Verification Evidence

### New Tests (14 new, 301 total — all passing)

```
PASS  apps/api/src/conversion/__tests__/redis-cursor.store.spec.ts
  RedisCursorStore
    getCursor
      ✓ should return null when no cursor stored
      ✓ should return parsed integer when cursor exists
      ✓ should return null for non-numeric values
    setCursor
      ✓ should persist cursor value

PASS  apps/api/src/ops/__tests__/psbt-retention.service.spec.ts
  PsbtRetentionService
    ✓ should return 0 when no PSBTs are eligible
    ✓ should archive settled PSBTs older than 90 days

PASS  apps/api/src/ops/__tests__/reconciliation.service.spec.ts
  ReconciliationService
    ✓ should return empty result when no payouts in window
    ✓ should match when Koya and Bria amounts agree
    ✓ should report mismatch when amounts differ
    ✓ should handle Bria lookup failure gracefully

PASS  apps/api/src/dfns/__tests__/dfns-health.controller.spec.ts
  DfnsHealthController
    ✓ should return ok when DFNS is healthy
    ✓ should return unhealthy when DFNS check fails

PASS  apps/api/src/conversion/__tests__/bria-event-consumer.spec.ts
  BriaEventConsumerService
    ✓ should skip subscription when driver is mock
    ✓ should subscribe to Bria events when driver is bria
    ✓ should resume from stored cursor on init         ← NEW
    ✓ should persist cursor after processing event     ← NEW
    ✓ should update txHash on payout_broadcast
    ✓ should transition session to COMPLETED on payout_settled
    ✓ should skip already CONFIRMED payouts on payout_settled (idempotent)
    ✓ should skip events for unknown payouts
    ✓ should unsubscribe on destroy
```

---

## Security

- **No new secrets** — cursor store and ops jobs use existing Redis and Prisma connections
- **No credentials in CI workflow** — DFNS secrets fetched at runtime from AWS Secrets Manager, written to `docker/secrets/` with `chmod 600`
- **Health check on internal path** — `/internal/health/dfns` is not exposed through the public API gateway
- **mTLS cert rotation runbook** documented in `docs/deployment/dfns-mtls.md`

---

## Future Work

- S3 archival in `PsbtRetentionService` — upload to `s3://koya-archives/payout_psbts/<year>/<month>/<externalId>.psbt.gz` (KMS-encrypted) before clearing blob
- CloudWatch `putMetricData` + SNS alarm in `ReconciliationService` — publish `Koya/Reconciliation/AbsDelta` metric, alarm at threshold
- `docker-compose.integration.yml` for CI stack with DFNS sandbox wiring
- Self-hosted runner provisioning (EC2 with Docker + AWS creds)
- DFNS sandbox credential provisioning in Secrets Manager
