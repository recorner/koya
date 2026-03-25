# Step 17 — Engine: Integration Compose, SNS Dual Subscription, CB Metrics

**Status:** Complete
**Date:** 2026-03-25
**Depends On:** Step 16 — S3 Archival, CloudWatch, Circuit Breaker, Ops Tooling

---

## Scope

Close remaining gaps between the engine.md specification and the Step 16 implementation. Six targeted changes to achieve full spec compliance.

---

## Deliverables

### D1 — docker-compose.integration.yml (spec F)

Created a dedicated integration Docker Compose stack that references DFNS sandbox by environment variables (no mock). Includes API, Redis, Bria, and bria-pg with DFNS mTLS cert paths mounted from `docker/secrets/`. All containers use `restart: 'no'` (ephemeral for testing) and unique container names (`koya-int-*`) to avoid collision with the dev stack.

### D2 — OneUptime SNS Subscription (spec B)

Added a second SNS subscription (`oneuptime_webhook`) in `terraform/aws/alerts_reconciliation.tf` alongside the existing Slack webhook. New variable `oneuptime_notification_endpoint` provides the OneUptime HTTPS webhook URL. Both subscriptions fire on the same SNS topic for all reconciliation alarms.

### D3 — CBOpenCount CloudWatch Metric (spec E)

When the circuit breaker is OPEN and rejects a PSBT signing attempt, `PsbtSigningService` now publishes `Koya/Signing/CBOpenCount` to CloudWatch. This enables alarming on CB open events separate from sign-pending latency.

### D4 — Nightly Workflow Update (spec C)

Updated `.github/workflows/nightly-dfns-integration.yml` to:
- Use `docker compose -f docker-compose.integration.yml` for start, logs, and teardown
- Call `./scripts/wait-for-services.sh` instead of inline health-check loop

### D5 — wait-for-services.sh (spec C)

New script that waits for Redis (port 6379), Bria gRPC (port 2742), and API health endpoint with a configurable timeout (default 120s). Used by the nightly workflow and can be used by `run-integration.sh`.

### D6 — run-integration.sh Updates (spec F)

Updated to:
- Use `docker-compose.integration.yml` instead of default compose file
- Upload integration logs to S3 when running in CI (`CI` env var set + `PSBT_ARCHIVE_BUCKET` available)

---

## Files Created

| File | Purpose |
|------|---------|
| `docker-compose.integration.yml` | Dedicated integration test stack with DFNS sandbox env vars |
| `scripts/wait-for-services.sh` | Health-check waiter for integration services |

## Files Modified

| File | Change |
|------|--------|
| `terraform/aws/alerts_reconciliation.tf` | Added `oneuptime_notification_endpoint` variable and `oneuptime_webhook` SNS subscription |
| `apps/api/src/conversion/psbt-signing.service.ts` | Publish `CBOpenCount` metric when circuit breaker rejects |
| `apps/api/src/conversion/__tests__/psbt-signing.service.spec.ts` | New test: CBOpenCount published when CB is open |
| `.github/workflows/nightly-dfns-integration.yml` | Use integration compose, call wait-for-services.sh |
| `scripts/run-integration.sh` | Use integration compose, S3 log upload in CI |
| `tasks/todo.md` | Phase 17 tracking |

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `apps/api` (all) | 315 | Pass |
| API lint | 0 errors, 4 warnings | Pass |
| API typecheck | 0 errors | Pass |

**New tests added: 1** (CBOpenCount metric on circuit breaker open)

---

## Security

- No secrets in code — DFNS sandbox credentials are injected via env vars and `docker/secrets/` mounted read-only
- S3 log upload uses IAM role credentials (no static keys)
- OneUptime webhook endpoint stored in Terraform variable, not hardcoded
