# Step 16 — Engine: S3 Archival, CloudWatch, Circuit Breaker, Ops Tooling

**Status:** Complete
**Date:** 2026-03-24
**Depends On:** Step 15 — Cursor Persistence, Ops, Retention, CI

---

## Scope

Full production ops implementation: S3 PSBT archival with KMS encryption, CloudWatch metrics and SNS alarms for reconciliation and signing latency, Redis-backed circuit breaker for PSBT signing, self-hosted GitHub Actions runner provisioning, DFNS mTLS certificate rotation automation, DFNS mock server for local integration testing, and comprehensive runbook expansion.

**Goal:** Remove mock-only dependency, enable heavy testing in staging, production-grade monitoring and alerting, automated cert lifecycle management, and resilient PSBT signing with circuit breaker protection.

---

## Deliverables

### D1 — S3 Archival for PSBT Retention

Updated `PsbtRetentionService` to upload PSBT data to S3 (KMS-encrypted, gzip-compressed) before marking DB rows as `[archived]`. If S3 upload fails, the PSBT is **not** archived (fail-safe).

**S3 path:** `payout_psbts/{year}/{month}/{externalId}.psbt.gz`

- Terraform: `terraform/aws/s3_psbt_archive.tf` — S3 bucket + KMS key with rotation, versioning, lifecycle (STANDARD_IA at 1yr, expire at 2yr), public access block
- Playbook: `docs/deployment/psbt-retention.md` — setup, IAM permissions, restore procedure

### D2 — CloudWatch Metrics + SNS Alarms for Reconciliation

Added `putMetricData` to `ReconciliationService` publishing two metrics:
- `Koya/Reconciliation/AbsDelta` — total absolute delta in sats
- `Koya/Reconciliation/MismatchCount` — number of mismatched payouts

Both include `Environment` dimension and are gated by `CLOUDWATCH_METRICS_ENABLED` env var.

- Terraform: `terraform/aws/alerts_reconciliation.tf` — SNS topic + 3 CloudWatch alarms (delta>0 warning, delta>1000 critical, mismatch count)
- Runbook: `docs/deployment/reconciliation.md` — metric definitions, triage steps, escalation procedures

### D3 — Nightly Self-Hosted Runner & GH Actions

- CloudFormation: `terraform/aws/runner_cf.yml` — EC2 instance with IAM role (Secrets Manager + S3 + CloudWatch), security group, user-data provisioning (Docker, Docker Compose, Node.js 22, pnpm, GitHub Actions runner agent)
- Setup script: `scripts/setup-self-hosted-runner.sh` — manual runner setup on existing EC2
- Updated `nightly-dfns-integration.yml` — added cert expiry check step, webhook secret fetch, Docker log collection, GH Actions warnings
- Docs: `docs/deployment/nightly-runner.md` — provisioning options, architecture diagram, troubleshooting

### D4 — DFNS mTLS Rotation & ECS Secret Mapping

- `scripts/rotate-dfns-mtls.sh` — validates cert/key match, uploads to Secrets Manager, optionally triggers ECS force redeploy
- `scripts/update-ecs-task-secret.sh` — registers new ECS task definition revision and forces deployment
- `scripts/check-cert-expiry.sh` — fetches cert from Secrets Manager, checks expiry, exits non-zero if <14 days

### D5 — Circuit Breaker + Sign-Latency Alert

**Circuit Breaker** (`CircuitBreaker` class, Redis-backed):
- 5 failures in 10 minutes → circuit opens for 15 minutes
- States: closed → open → half-open → closed
- Redis keys: `koya:cb:psbt_signing:failures` (sorted set), `koya:cb:psbt_signing:open_until` (string)
- Integrated into `PsbtSigningService.handlePayoutCommitted()` — blocks signing when circuit is open

**Sign-Latency Metric:**
- `checkSignPendingLatency()` method on `PsbtSigningService` — counts PSBTs stuck in `signing_pending` > 10 minutes
- Publishes `Koya/Signing/SignPendingCount` to CloudWatch
- Terraform alarm: `terraform/aws/alerts_signing.tf`

### D6 — DFNS Mock + Integration Script

- `scripts/dfns-mock/server.js` — Node.js HTTP server (no dependencies) with:
  - `POST /v1/sign-psbt` — idempotent signing (in-memory store)
  - `POST /v1/webhook/test` — sends HMAC-signed webhook to target
  - `GET /health` — health probe
- `scripts/run-dfns-mock.sh` — start mock in background, wait for health
- `scripts/run-integration.sh` — full orchestration: build Docker, start stack, start DFNS mock, run integration tests, collect logs, tear down

### D7 — Full Runbook Expansion

Updated `docs/deployment/dfns-mtls.md` with:
- Circuit breaker documentation (states, Redis keys, manual reset)
- Automated cert rotation procedure with `scripts/rotate-dfns-mtls.sh`
- Pre-deploy cert expiry check
- Sign-latency alarm triage steps
- Reconciliation alarm triage with SQL queries and Bria gRPC commands
- On-call procedures: escalation path (L1→L2→L3), daily checks checklist
- Local integration test instructions

---

## Files Created

| File | Purpose |
|------|---------|
| `terraform/aws/s3_psbt_archive.tf` | S3 bucket + KMS key for PSBT archive |
| `terraform/aws/alerts_reconciliation.tf` | CloudWatch alarms + SNS topic for reconciliation |
| `terraform/aws/alerts_signing.tf` | CloudWatch alarm for sign-pending latency |
| `terraform/aws/runner_cf.yml` | CloudFormation for self-hosted GH Actions runner |
| `scripts/setup-self-hosted-runner.sh` | Manual runner provisioning script |
| `scripts/rotate-dfns-mtls.sh` | mTLS certificate rotation automation |
| `scripts/update-ecs-task-secret.sh` | ECS task definition + deployment update |
| `scripts/check-cert-expiry.sh` | Pre-deploy certificate expiry check |
| `scripts/dfns-mock/server.js` | DFNS mock server for local testing |
| `scripts/dfns-mock/package.json` | Mock server package |
| `scripts/run-dfns-mock.sh` | Start DFNS mock in background |
| `scripts/run-integration.sh` | Full integration test orchestrator |
| `docs/deployment/psbt-retention.md` | S3 archival playbook + restore procedure |
| `docs/deployment/reconciliation.md` | Reconciliation monitoring runbook |
| `docs/deployment/nightly-runner.md` | Self-hosted runner setup guide |
| `apps/api/src/conversion/circuit-breaker.ts` | Redis-backed circuit breaker |
| `apps/api/src/conversion/__tests__/circuit-breaker.spec.ts` | 8 circuit breaker tests |

## Files Modified

| File | Change |
|------|--------|
| `apps/api/src/ops/psbt-retention.service.ts` | S3 upload with KMS before archival, ConfigService injection, S3Client initialization |
| `apps/api/src/ops/reconciliation.service.ts` | CloudWatch `putMetricData` for AbsDelta and MismatchCount, ConfigService injection |
| `apps/api/src/conversion/psbt-signing.service.ts` | Circuit breaker integration, CloudWatch sign-latency metric, `checkSignPendingLatency()` method, Redis client injection |
| `apps/api/src/ops/__tests__/psbt-retention.service.spec.ts` | S3 mock, 4 tests (was 2), added S3 upload and failure scenario tests |
| `apps/api/src/ops/__tests__/reconciliation.service.spec.ts` | Added ConfigService mock |
| `apps/api/src/conversion/__tests__/psbt-signing.service.spec.ts` | Added Redis null parameter, CloudWatch SDK mock |
| `.github/workflows/nightly-dfns-integration.yml` | Added cert expiry check, webhook secret fetch, log collection step |
| `docs/deployment/dfns-mtls.md` | Full runbook expansion: circuit breaker, rotation scripts, on-call procedures, daily checks |
| `package.json` | Added `@aws-sdk/client-s3`, `@aws-sdk/client-cloudwatch` dependencies |

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `apps/api` (all) | 314 | ✅ |
| `libs/bria-adapter` | 23 | ✅ |
| `libs/dfns-sdk` | 29 | ✅ |
| API lint | 0 errors, 4 warnings | ✅ |
| API typecheck | 0 errors | ✅ |

**New tests added: 13** (was 301, now 314)

```
PASS  apps/api/src/conversion/__tests__/circuit-breaker.spec.ts
  CircuitBreaker
    getState
      ✓ should return closed when no open_until key exists
      ✓ should return open when open_until is in the future
      ✓ should return half-open when open_until has passed
    canExecute
      ✓ should allow execution when circuit is closed
      ✓ should reject execution when circuit is open
      ✓ should allow execution when circuit is half-open
    recordFailure
      ✓ should open circuit when failures exceed threshold
      ✓ should not open circuit when failures are below threshold
    recordSuccess
      ✓ should close circuit when in half-open state
      ✓ should do nothing when circuit is already closed
    without Redis
      ✓ should always return closed state

PASS  apps/api/src/ops/__tests__/psbt-retention.service.spec.ts
  PsbtRetentionService
    ✓ should return 0 when no PSBTs are eligible
    ✓ should archive settled PSBTs older than 90 days (no S3)
  PsbtRetentionService (with S3)
    ✓ should upload to S3 before archiving
    ✓ should skip DB update when S3 upload fails
```

---

## Security

- **No secrets in code** — all credentials via env vars and Secrets Manager
- **KMS encryption** — S3 PSBT archives encrypted at rest with dedicated KMS key
- **Cert rotation scripts validate cert/key match** before uploading
- **Circuit breaker prevents cascade** — stops hammering a failing DFNS endpoint
- **S3 bucket has public access block** — no accidental exposure
- **Scripts don't log secrets** — only paths and status messages
- **DFNS mock uses in-memory store only** — no persistence of test data

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         Production Ops Stack                              │
│                                                                           │
│  ┌──────────────────────┐   ┌───────────────────────────────────────┐    │
│  │ PsbtRetentionService │   │ ReconciliationService                 │    │
│  │ @Cron(02:00 UTC)     │   │ @Cron(03:00 UTC)                     │    │
│  │                      │   │                                       │    │
│  │ S3 upload (KMS) ────►│   │ putMetricData ────► CloudWatch ──►SNS│    │
│  │ Mark [archived]      │   │                                       │    │
│  └──────────────────────┘   └───────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ PsbtSigningService                                               │    │
│  │                                                                  │    │
│  │ CircuitBreaker ──► Redis (koya:cb:psbt_signing:*)               │    │
│  │ SignPendingCount ──► CloudWatch (Koya/Signing) ──►SNS           │    │
│  │                                                                  │    │
│  │ Bria → [CB check] → DFNS sign → Bria broadcast                 │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────────────┐   ┌──────────────────────────────────────┐    │
│  │ Nightly CI Runner    │   │ Cert Lifecycle                       │    │
│  │                      │   │                                       │    │
│  │ EC2 (self-hosted)    │   │ rotate-dfns-mtls.sh                  │    │
│  │ Docker + GH Runner   │   │ check-cert-expiry.sh                 │    │
│  │ AWS Secrets Manager  │   │ update-ecs-task-secret.sh            │    │
│  └──────────────────────┘   └──────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────┘
```
