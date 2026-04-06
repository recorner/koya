# Step 20 — API Ingress Hardening & Scale Readiness

**Date:** 2026-04-06  
**Scope:** API security middleware, Redis-backed rate limiting, migration separation, WAF, autoscaling, alarms

---

## What Existed Before

- API booted with `ValidationPipe` and CORS, but **no helmet, no trust-proxy, no body limits, no correlation IDs, no graceful shutdown**
- `@nestjs/throttler` was installed but **not wired** into the app module
- **Empty stub files** in `apps/api/src/security/` — zero implementation
- **Migrations ran on every container start** (`prisma migrate deploy && node main.js`), blocking fast scale-out
- **No WAF** on the ALB
- **No autoscaling** policies on ECS
- **No ingress-specific CloudWatch alarms**

## What Was Added

### Part 1 — NestJS Ingress Hardening

**`main.ts` bootstrap:**
- `helmet` for security headers
- `trust proxy` (configurable via `TRUST_PROXY_HOPS`)
- Body size limits: JSON 100kb, URL-encoded 100kb (env-configurable)
- `x-request-id` correlation ID on every request/response (reads from header or generates UUID)
- `enableShutdownHooks()` for clean container termination

**Redis-backed rate limiting (`apps/api/src/security/`):**
- `RedisThrottlerStorage` — atomic increment via Redis MULTI, fail-open on Redis errors, block key support
- `KoyaThrottlerGuard` — extracts client IP from X-Forwarded-For, skips health/internal routes
- `ApiSecurityModule` — wires ThrottlerModule with env-driven defaults (60 req/min/IP)
- Module integrated into `AppModule`

**Route-specific decorators:**

| Decorator | Limit | Applied To |
|-----------|-------|-----------|
| `@QuoteThrottle()` | 20 req/min/IP | quote, session create |
| `@SubmitThrottle()` | 10 req/min/IP | identity, payout details |
| `@PaymentThrottle()` | 10 req/min/IP | initiate-payment, confirm-reference |
| `@StatusThrottle()` | 60 req/min/IP | status, by-reference status |
| `@WebhookThrottle()` | 120 req/min/IP | M-Pesa callback, DFNS webhook, WhatsApp webhook |
| `@SkipThrottle()` | ∞ | health, health/cache, health/rates |

### Part 2 — Container & Migration Hardening

- **Dockerfile CMD** changed from `prisma migrate deploy && node main.js` to `node main.js`
- **Migration script** at `apps/api/scripts/migrate.sh` — runs as separate ECS task
- **Migration ECS task definition** at `infra/ecs-migrate-task-definition.json` (lightweight: 256 CPU, 512 MB)
- **Deploy script** at `scripts/deploy-api.sh` — orchestrates migrate → update-service

### Part 3 — AWS WAF (`terraform/aws/waf.tf`)

- Web ACL with 6 rules:
  1. AWS Managed Common Rule Set (OWASP)
  2. Known Bad Inputs (SQLi, XSS)
  3. IP Reputation List
  4. Global rate: 2000 req/5min/IP
  5. Conversion rate: 500 req/5min/IP on `/api/v1/guest-conversion/*`
  6. Webhook rate: 1000 req/5min/IP on callback/webhook paths
- WAF ↔ ALB association
- WAF logging to CloudWatch

### Part 4 — ECS Autoscaling (`terraform/aws/ecs_autoscaling.tf`)

- CPU target tracking: 60%
- Memory target tracking: 70%
- ALB request count per target (optional)
- Scale-out cooldown: 60s, scale-in cooldown: 300s
- Defaults: min=2, max=10 (production); configurable via Terraform vars

### Part 5 — CloudWatch Alarms (`terraform/aws/alerts_ingress.tf`)

- High 429 rate (>50/5min)
- High 5xx rate (>10/5min)
- High target response time (>5s avg)
- High request count (>10k/5min)
- Unhealthy target count (>0)
- WAF blocked requests spike (>100/5min)
- All route to SNS topic `koya-ingress-alerts-{env}`

### Part 6 — Documentation

- **New:** `docs/runbooks/api-hardening.md` — full runbook with rate limit profiles, alarm response, testing guide
- **Updated:** `docs/deployment/ecs-fargate.md` — architecture diagram, WAF, autoscaling, migration flow, new env vars, costs
- **Updated:** `docs/runbooks/cold-start.md` — new Step 3.8 for migration task
- **Updated:** `docs/runbooks/environment-matrix.md` — security/hardening env vars section

### Part 7 — Environment Variables

Added to `docker/api.env.example` and `infra/ecs-task-definition.json`:
- `TRUST_PROXY_HOPS`, `JSON_BODY_LIMIT`, `URLENCODED_BODY_LIMIT`
- `THROTTLE_DEFAULT_LIMIT`, `THROTTLE_DEFAULT_TTL_SECONDS`

### Part 8 — Tests

- **Unit:** `redis-throttler.storage.spec.ts` — 6 tests (increment, TTL, blocking, fail-open, key prefix)
- **Unit:** `koya-throttler.guard.spec.ts` — 7 tests (IP extraction, route skipping)
- **Integration:** `throttling.integration.spec.ts` — 3 tests (429 after limit, webhook under threshold, health skip)
- **Result:** 26 unit test suites (282 tests) pass, integration suite passes

## What Is Still Deferred

- AWS API Gateway (not needed yet — ALB + WAF is sufficient)
- Request timeout middleware (`REQUEST_TIMEOUT_MS`) — can be added when timeout issues observed
- App-level CloudWatch metrics for throttle counts (circuit breaker already emits `CBOpenCount`)
- WAF IP allowlist for trusted internal ranges
- Per-route env-variable override for rate limits (currently in code decorators)

## Why ALB + WAF Over API Gateway

1. **ALB is already primary ingress** — adding API Gateway would add a second hop (+latency, +cost, +complexity)
2. **WAF managed rules** cover OWASP protections, IP reputation, and rate limiting at the edge
3. **App-level Redis throttling** provides fine-grained per-route, per-IP control that WAF can't match
4. **Cost:** ALB + WAF ≈ $31/mo vs API Gateway ≈ $50+/mo for same traffic
5. **Sufficient for current stage** — API Gateway becomes valuable when we need API keys, usage plans, or request transformation for partner integrations
