# Cold-Start Checklist

**Last updated:** 2026-04-05

Use this checklist to verify a complete cold start. Check off each item as you confirm it.

---

## Automated Validation

Run the automated validation to check bootstrap readiness:
```bash
./scripts/validate-bootstrap.sh staging
```

This checks:
- Environment files have all required variables
- Secrets map is valid and complete
- Task definition templates have correct placeholders
- Terraform layer structure is intact
- All scripts are executable

---

## Pre-Flight

- [ ] AWS CLI configured and authenticated (`aws sts get-caller-identity`)
- [ ] Docker and Docker Compose installed
- [ ] Node.js 22+ and pnpm 10+ installed
- [ ] Repository cloned and dependencies installed (`pnpm install`)
- [ ] Prisma client generated (`pnpm prisma generate --schema=apps/api/prisma/schema.prisma`)

---

## AWS Infrastructure

### Secrets Manager (19 entries)
- [x] `/koya/api/DATABASE_URL` — real connection string (db.koyabank.com)
- [x] `/koya/api/REDIS_URL` — real Redis URL (redis.koyabank.com)
- [x] `/koya/api/REDIS_PASSWORD` — real password
- [ ] `/koya/api/FX_API_KEY` — real FX API key
- [ ] `/koya/api/SLACK_WEBHOOK_URL` — real Slack webhook
- [ ] `/koya/daraja/consumerKey` — real Daraja key
- [ ] `/koya/daraja/consumerSecret` — real Daraja secret
- [ ] `/koya/daraja/passkey` — real Daraja passkey
- [ ] `/koya/dfns/apiKey` — real DFNS API key
- [ ] `/koya/dfns/mTLS/cert` — real mTLS certificate PEM
- [ ] `/koya/dfns/mTLS/key` — real mTLS private key PEM
- [ ] `/koya/dfns/mTLS/ca` — real mTLS CA PEM
- [ ] `/koya/dfns/webhookSecret` — real HMAC secret
- [ ] `/koya/bria/signerEncryptionKey` — generated 32-byte hex
- [ ] `/koya/bria/pgConnection` — real Bria PG connection
- [ ] `/koya/bria/apiKey` — real Bria API key
- [ ] `/koya/whatsapp/appSecret` — Meta app secret
- [ ] `/koya/whatsapp/verifyToken` — Meta webhook verify token
- [ ] `/koya/whatsapp/accessToken` — Meta Cloud API access token
- [ ] `/koya/telegram/botToken` — Telegram bot token (if enabled)
- [ ] `/koya/telegram/webhookSecret` — Telegram webhook secret (if enabled)
- [ ] `/koya/directus/token` — real Directus token

### Compute & Networking
- [ ] ECR repository `koya/api` exists
- [ ] ECS cluster `koya` is ACTIVE
- [ ] CloudWatch log group `/ecs/koya-api` exists
- [ ] IAM role `ecsTaskExecutionRole` with `KoyaSecretsAccess` policy
- [ ] IAM role `koyaApiTaskRole` with S3/CloudWatch/SNS permissions
- [ ] IAM role `github-actions-deploy` with OIDC trust
- [ ] ALB `koya-api-alb` exists and is provisioned
- [ ] ALB security group allows 80/443 inbound
- [ ] ECS security group allows 3333 from ALB SG only
- [ ] Target group `koya-api-tg` health check on `/api/v1/health`

### TLS & DNS
- [x] ACM certificate for `api.koyabank.com` — status: ISSUED
- [x] DNS CNAME validation record added
- [x] HTTPS listener on ALB port 443 with ACM cert
- [x] HTTP→HTTPS redirect listener on port 80
- [x] DNS `api.koyabank.com` → ALB DNS name
- [x] DNS `db.koyabank.com` → 34.79.165.195 (GCP cassini)
- [x] DNS `redis.koyabank.com` → 34.79.165.195 (GCP cassini)

### Storage & Monitoring
- [ ] S3 bucket `koya-archives-staging` (versioned, blocked public)
- [ ] S3 bucket `koya-archives-prod` (versioned, blocked public)
- [ ] KMS key `alias/koya-psbt-archive` (rotation enabled)
- [ ] S3 lifecycle: Glacier after 90 days
- [ ] SNS topic `koya-ops-alarms` exists
- [ ] SNS subscription(s) confirmed (email/Slack)
- [ ] CloudWatch alarm: `Koya-Reconciliation-AbsDelta-Warning`
- [ ] CloudWatch alarm: `Koya-Reconciliation-AbsDelta-Critical`
- [ ] CloudWatch alarm: `Koya-Reconciliation-MismatchCount-Warning`
- [ ] CloudWatch alarm: `Koya-Signing-PendingCount-Warning`
- [ ] CloudWatch alarm: `Koya-API-UnhealthyHosts`

---

## Runtime Services

### Database
- [x] PostgreSQL (GCP cassini / db.koyabank.com) is reachable from ECS
- [x] Database `koya` exists
- [x] Prisma migrations applied (6 migrations)
- [ ] SSL connection verified (staging uses plaintext — acceptable for dev)

### Redis
- [x] Redis reachable from API (redis.koyabank.com:6379)
- [x] AUTH works (password set)
- [ ] TLS connection works (staging uses plaintext — acceptable for dev)
- [x] `PING` returns `PONG`

### Bria
- [ ] Bria PostgreSQL running (PG 16)
- [ ] Bria daemon running (port 2742 responding)
- [ ] Bria account bootstrapped (admin: bootstrap, createAccount)
- [ ] Profile created
- [ ] Xpub imported
- [ ] Wallet created
- [ ] Payout queue configured

### DFNS
- [ ] API key or mTLS certs in place
- [ ] `GET /internal/health/dfns` returns `{ "status": "ok" }`
- [ ] Webhook URL configured in DFNS dashboard
- [ ] Webhook secret matches Secrets Manager value
- [ ] Circuit breaker Redis keys clean (`koya:cb:psbt_signing:*`)

---

## Application

### API
- [x] ECS task running (desired=1, running=1, revision koya-api:2)
- [x] Container passes health check (`GET /api/v1/health`)
- [x] Cache connected (`GET /api/v1/health` → cache.status=ok)
- [x] Rates live (`GET /api/v1/health` → rates.status=ok)
- [ ] DFNS healthy (`GET /internal/health/dfns`)
- [x] Logs flowing to CloudWatch `/ecs/koya-api`

### Web
- [ ] Vercel deployment succeeded (check GitHub Actions)
- [ ] `https://koyabank.com` returns 200
- [ ] `/convert` page loads
- [ ] API calls from web → api.koyabank.com work (no CORS errors)

### Ops
- [ ] Reconciliation cron registered (03:00 UTC daily)
- [ ] PSBT retention cron registered (02:00 UTC daily)
- [ ] Bria event consumer subscribed (if driver=bria/dfns)
- [ ] Redis cursor persisted (`koya:cursor:bria_event_consumer`)
- [ ] Nightly runner workflow enabled in GitHub Actions
- [ ] Self-hosted runner online and labeled: `self-hosted, linux, docker`

---

## CI/CD

### GitHub Secrets
- [ ] `VERCEL_TOKEN` set
- [ ] `VERCEL_ORG_ID` set
- [ ] `VERCEL_PROJECT_ID` set
- [ ] `AWS_ROLE_ARN` set to `arn:aws:iam::286119371044:role/github-actions-deploy`

### Vercel
- [ ] Project linked (org ID + project ID match)
- [ ] Git auto-deploy **disabled** (GitHub Actions is deploy authority)
- [ ] `NEXT_PUBLIC_API_URL` set in Vercel environment variables
- [ ] Framework: Next.js
- [ ] Build command: `npx nx build web`
- [ ] Output directory: `apps/web/.next`

### Workflows
- [ ] `ci.yml` runs on push to main/develop and PRs
- [ ] `nightly-dfns-integration.yml` runs daily at 03:00 UTC
- [ ] `deploy-api.yml` runs on push to main (apps/api/** or libs/**)

---

## Final Verification

- [ ] Create a test guest conversion quote via API
- [ ] Verify quote returns rate, fee, and TTL
- [ ] Check CloudWatch alarms are in OK/INSUFFICIENT_DATA state
- [ ] Verify no errors in `/ecs/koya-api` log group (last 15 minutes)
- [ ] Confirm `docker compose down -v` tears down local cleanly (if local)

---

**Next step after checklist passes:** Run the structured test suite.

```bash
# Unit tests
pnpm nx test api --testPathIgnorePatterns="integration"

# Integration tests (needs running services)
pnpm nx test api --testPathPattern="integration"

# E2E tests
pnpm nx run api-e2e:test
```
