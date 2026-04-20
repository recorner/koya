# API Hardening Runbook

## Overview

This document covers the API ingress hardening, rate limiting, WAF configuration, autoscaling, and alarm setup for the Koya API.

## Architecture

```
Internet → Route53 → ALB (HTTPS/443) → WAF → ECS Fargate (port 3333) → App
                                                    ↓
                                              Redis (throttle state)
                                              PostgreSQL
                                              Bria / DFNS / Daraja
```

### Why ALB + WAF instead of API Gateway?

- **Simplicity:** ALB is already the primary ingress; adding API Gateway would add a second hop, extra latency, and deployment complexity.
- **Cost:** ALB + WAF is cheaper than API Gateway for our traffic profile.
- **Sufficient protection:** WAF managed rules + app-level Redis throttling covers OWASP protections, rate limiting, and IP reputation.
- **Future option:** API Gateway can be layered in later if we need API key management, usage plans, or request transformation — but it's not needed now.

---

## Rate Limiting

### How It Works

Rate limiting is implemented in two layers:

1. **AWS WAF (edge):** Rate-based rules at the ALB, blocking IPs that exceed thresholds before traffic reaches containers.
2. **App-level (NestJS):** Redis-backed `@nestjs/throttler` with per-route policies, respecting real client IP from `X-Forwarded-For`.

### Endpoint Rate Limit Profiles

| Endpoint Group | Route Pattern | App Limit | WAF Limit | Abuse Risk | Notes |
|---|---|---|---|---|---|
| **Quote/Session Create** | `POST /guest-conversion/quote`, `/session` | 20 req/min/IP | 500/5min/IP | HIGH | Prevent quote flooding |
| **Identity/Payout Submit** | `POST /guest-conversion/:id/identity`, `/payout-details` | 10 req/min/IP | 500/5min/IP | HIGH | Sensitive PII endpoints |
| **Payment Initiation** | `POST /guest-conversion/:id/initiate-payment`, `/confirm-reference` | 10 req/min/IP | 500/5min/IP | HIGH | Triggers M-Pesa STK push |
| **Status Polling** | `GET /guest-conversion/:id/status`, `/by-reference/:ref/status` | 60 req/min/IP | 500/5min/IP | MEDIUM | Frequent polling expected |
| **M-Pesa Callback** | `POST /payments/mpesa/callback` | 120 req/min/IP | 1000/5min/IP | MEDIUM | Provider traffic, signature verified |
| **DFNS Webhook** | `POST /dfns/webhook` | 120 req/min/IP | 1000/5min/IP | MEDIUM | Provider traffic, signature verified |
| **WhatsApp Cloud Webhook** | `POST /messaging/webhooks/whatsapp-cloud` | 120 req/min/IP | 1000/5min/IP | MEDIUM | Provider traffic, signature verified |
| **Telegram Webhook** | `POST /messaging/webhooks/telegram` | 120 req/min/IP | 1000/5min/IP | MEDIUM | Provider traffic, secret-token verified |
| **Health** | `GET /health`, `/health/*` | Skipped | 2000/5min/IP | LOW | ALB health checks |
| **DFNS Internal Health** | `GET /internal/health/dfns` | Skipped | N/A | LOW | Internal route |

### Changing Thresholds

All app-level limits are environment-driven:

```bash
# Default policy (applies to unlabeled routes)
THROTTLE_DEFAULT_LIMIT=60
THROTTLE_DEFAULT_TTL_SECONDS=60

# Per-route overrides are in code decorators but can be adjusted
# by modifying throttle.decorators.ts
```

WAF limits are in Terraform variables:

```bash
terraform apply \
  -var="waf_global_rate_limit=2000" \
  -var="waf_conversion_rate_limit=500" \
  -var="waf_webhook_rate_limit=1000"
```

### Testing Rate Limiting in Staging

```bash
# Test app-level throttling (should get 429 after limit)
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://api-staging.koyabank.com/api/v1/guest-conversion/quote \
    -X POST -H "Content-Type: application/json" \
    -d '{"sourceAsset":"KES","targetAsset":"BTC","sourceAmount":"1000","channel":"WEB"}'
done

# Verify 429 response includes Retry-After headers
curl -v https://api-staging.koyabank.com/api/v1/guest-conversion/quote \
  -X POST -H "Content-Type: application/json" \
  -d '{"sourceAsset":"KES","targetAsset":"BTC","sourceAmount":"1000","channel":"WEB"}'
```

---

## Bootstrap Security Middleware

Applied in `apps/api/src/main.ts`:

| Middleware | Purpose |
|---|---|
| `helmet` | Security HTTP headers (CSP, HSTS, X-Frame-Options, etc.) |
| `trust proxy` | Correct client IP resolution behind ALB (configurable hops) |
| Body size limits | JSON: 100kb, URL-encoded: 100kb (prevents payload abuse) |
| Correlation ID | `x-request-id` header on every request/response (traces requests across logs) |
| Graceful shutdown | `enableShutdownHooks()` for clean container termination |

---

## Migration Separation

### Before
API container ran `prisma migrate deploy && node main.js` on every start.
This meant every scale-out event re-ran migrations, adding startup latency and risk.

### After
- API container CMD: `node main.js` (fast startup)
- Migrations: separate ECS task (`koya-api-migrate`) run during deploy, before service update
- Deploy script: `scripts/deploy-api.sh` orchestrates migrate → update

### Running Migrations Manually

```bash
# Via ECS RunTask
aws ecs run-task \
  --cluster koya-api \
  --task-definition koya-api-migrate \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[...],securityGroups=[...],assignPublicIp=ENABLED}"

# Via Docker locally
docker run --rm --env DATABASE_URL=... koya/api:latest sh /app/scripts/migrate.sh
```

---

## Autoscaling

| Parameter | Staging | Production |
|---|---|---|
| Min tasks | 1 | 2 |
| Desired | 1 | 2 |
| Max tasks | 4 | 10 |
| CPU target | 60% | 60% |
| Memory target | 70% | 70% |
| Scale-out cooldown | 60s | 60s |
| Scale-in cooldown | 300s | 300s |

---

## CloudWatch Alarms

| Alarm | Threshold | Period | Meaning |
|---|---|---|---|
| High 429 rate | >50/5min | 5min | App or WAF throttling heavily — check if legitimate traffic or abuse |
| High 5xx rate | >10/5min | 5min | App errors — check logs, DB, Redis, provider health |
| High latency | >5s avg | 10min | Slow responses — check DB queries, Redis latency, provider latency |
| High request count | >10k/5min | 5min | Traffic spike — check if organic or DDoS |
| Unhealthy targets | >0 | 1min | ECS task failing health checks — check container logs |
| WAF blocked spike | >100/5min | 5min | WAF blocking traffic — check if attack or false positive |

### Responding to Alarms

1. **429 alarm:** Check CloudWatch logs for throttled IPs. If legitimate, increase limits. If abuse, verify WAF is blocking.
2. **5xx alarm:** Check `/ecs/koya-api` logs. Common causes: DB connection pool exhaustion, Redis timeout, Bria/DFNS down.
3. **Latency alarm:** Check target response time breakdown. If DB-related, check connection count and query performance.
4. **Request count alarm:** Check WAF metrics for pattern. If DDoS, WAF should auto-block. If organic, consider scaling.
5. **Unhealthy targets:** Check ECS task logs. If OOM, increase memory. If health check timeout, check startup time.
6. **WAF blocked spike:** Check WAF sampled requests. If false positive, add rule exception. If attack, monitor.

---

## Environment Variables

### New Variables (this change)

| Variable | Default | Description |
|---|---|---|
| `TRUST_PROXY_HOPS` | `1` | Number of trusted proxy hops (ALB = 1) |
| `JSON_BODY_LIMIT` | `100kb` | Maximum JSON request body size |
| `URLENCODED_BODY_LIMIT` | `100kb` | Maximum URL-encoded body size |
| `THROTTLE_DEFAULT_LIMIT` | `60` | Default rate limit (requests per TTL window) |
| `THROTTLE_DEFAULT_TTL_SECONDS` | `60` | Default rate limit window (seconds) |

---

## Container Safety

Verified:
- [x] Non-root user (`koya`, uid 1001)
- [x] No secrets baked into image
- [x] Health endpoint functional (`/api/v1/health`)
- [x] Migrations separated from startup
- [x] Image builds cleanly from multi-stage Dockerfile
- [x] Production dependencies only in final stage
