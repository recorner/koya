# Step 18 — Full Cold Start from Zero

**Status:** Complete  
**Date:** 2026-04-05  
**Depends On:** Step 17 — Integration Compose, SNS Dual Subscription, CB Metrics

---

## Scope

Execute a full cold start of Koya from zero: provision all AWS infrastructure via CLI, create secrets, configure networking, set up CI/CD, and produce comprehensive runbook documentation.

---

## What Was Created

### AWS Infrastructure (all via CLI, us-east-1)

| Resource | Identifier | Status |
|----------|-----------|--------|
| **ECR Repository** | `koya/api` (scan-on-push, AES256) | Active |
| **ECS Cluster** | `koya` (Fargate + Fargate Spot) | Active |
| **ECS Service** | `koya-api` (desired: 0, pending ALB) | Active |
| **ECS Task Definition** | `koya-api:1` (512 CPU, 1024 MB, 9 secrets) | Registered |
| **ALB** | `koya-api-alb` (internet-facing) | Active |
| **Target Group** | `koya-api-tg` (port 3333, health: `/api/v1/health`) | Created |
| **HTTP Listener** | Port 80 → 301 redirect to HTTPS | Active |
| **ACM Certificate** | `api.koyabank.com` | Pending DNS validation |
| **ALB Security Group** | `sg-0ee774be0b9af2b8e` (80, 443 inbound) | Active |
| **ECS Security Group** | `sg-02df170a0f0b30d1f` (3333 from ALB SG) | Active |
| **IAM: ecsTaskExecutionRole** | ECS exec + Secrets Manager `/koya/*` | Active |
| **IAM: koyaApiTaskRole** | S3, CloudWatch, SNS, Logs | Active |
| **IAM: github-actions-deploy** | OIDC trust for `koyabank/*` repos | Active |
| **OIDC Provider** | GitHub Actions token.actions.githubusercontent.com | Active |
| **CloudWatch Log Group** | `/ecs/koya-api` (30-day retention) | Active |
| **S3 Bucket** | `koya-archives-staging` (versioned, blocked public, Glacier 90d) | Active |
| **S3 Bucket** | `koya-archives-prod` (versioned, blocked public, Glacier 90d) | Active |
| **KMS Key** | `alias/koya-psbt-archive` (auto-rotation) | Active |
| **SNS Topic** | `koya-ops-alarms` | Active |
| **CloudWatch Alarms** | 5 alarms (recon warning/critical, mismatch, signing, API health) | All OK |

### Secrets Manager (19 entries under `/koya/`)

- **API:** DATABASE_URL, REDIS_URL, REDIS_PASSWORD, FX_API_KEY, SLACK_WEBHOOK_URL
- **Daraja:** consumerKey, consumerSecret, passkey
- **DFNS:** apiKey, mTLS/cert, mTLS/key, mTLS/ca, webhookSecret
- **Bria:** signerEncryptionKey (generated), pgConnection, apiKey
- **Twilio:** accountSid, authToken
- **Directus:** token

### CI/CD

| Workflow | File | Runner | Trigger |
|----------|------|--------|---------|
| CI | `.github/workflows/ci.yml` | self-hosted | Push main/develop, PRs |
| Deploy API | `.github/workflows/deploy-api.yml` | self-hosted | Push main (api/libs paths) |
| Nightly DFNS | `.github/workflows/nightly-dfns-integration.yml` | self-hosted | Daily 03:00 UTC |

All CI jobs now run on `[self-hosted, linux, docker]` per project requirement.

### Runbook Documents Created

| Document | Content |
|----------|---------|
| `docs/runbooks/cold-start.md` | Full cold-start procedure (local, staging, production) with rollback |
| `docs/runbooks/cold-start-checklist.md` | 70+ checkable verification items |
| `docs/runbooks/environment-matrix.md` | Every env var by environment with source mapping |
| `docs/runbooks/service-dependency-map.md` | 22-service inventory, dependency graph, startup order, port map |

### Other Files

| File | Purpose |
|------|---------|
| `infra/ecs-task-definition.json` | Full task def with 22 env vars + 9 secrets |
| `.github/workflows/deploy-api.yml` | Build→ECR→ECS deploy pipeline |

---

## DNS & Networking (completed post-bootstrap)

| Record | Type | Target |
|--------|------|--------|
| `_acm-validation.api.koyabank.com` | CNAME | ACM validation endpoint |
| `api.koyabank.com` | CNAME | `koya-api-alb-1746028093.us-east-1.elb.amazonaws.com` |
| `db.koyabank.com` | A | `34.79.165.195` (GCP cassini) |
| `redis.koyabank.com` | A | `34.79.165.195` (GCP cassini) |

## Staging Infrastructure (GCP cassini VM)

| Service | Config |
|---------|--------|
| PostgreSQL 14 | user=koya, db=koya, scram-sha-256, listen 0.0.0.0:5432 |
| Redis 6.0.16 | password auth, listen 0.0.0.0:6379 |
| GCP Firewall | `allow-postgres-staging` (tcp:5432), `allow-redis-staging` (tcp:6379) |

6 Prisma migrations applied to staging database.

## Deployment Milestones

1. ACM cert validated (ISSUED) via Cloudflare DNS
2. HTTPS listener created on ALB
3. Docker image built and pushed to ECR (`koya/api:latest`)
4. DATABASE_URL, REDIS_PASSWORD, REDIS_URL secrets updated with real values
5. ECS task definition koya-api:2 registered (REDIS_HOST → redis.koyabank.com)
6. ECS service updated, task RUNNING + HEALTHY
7. **API live**: `https://api.koyabank.com/api/v1/health` → `{"status":"ok"}`

---

## Verification

```
✅ 19/19 secrets created (3 updated from placeholder)
✅ ECR repository exists with pushed image
✅ ECS cluster ACTIVE
✅ ECS service ACTIVE (desired=1, running=1, HEALTHY)
✅ Task definition registered (revision 2)
✅ ALB active with HTTPS listener (ACM cert ISSUED)
✅ Target group passing health checks
✅ HTTP→HTTPS redirect listener
✅ 2 security groups (ALB + ECS)
✅ 3 IAM roles with correct policies
✅ GitHub OIDC provider
✅ Log group /ecs/koya-api (30-day retention)
✅ 2 S3 buckets (versioned, Glacier lifecycle)
✅ KMS key with rotation
✅ SNS topic created
✅ 5 CloudWatch alarms (all OK state)
✅ 3 CI/CD workflows (all on self-hosted runner)
✅ 4 runbook documents
✅ ECS task definition JSON in infra/
✅ PostgreSQL staging DB with all migrations
✅ Redis staging with password auth
✅ 4 DNS records (api, db, redis, ACM validation)
✅ API live at https://api.koyabank.com/api/v1/health
```

---

## Remaining

1. Replace 16 remaining placeholder secrets (Daraja, DFNS, Twilio, etc.)
2. Vercel project linking + GitHub secrets for web deployment
3. Self-hosted runner provisioning
4. Web deployment (Vercel)
6. Link Vercel, set GitHub secrets, deploy web
7. Run full smoke check per `docs/runbooks/cold-start-checklist.md`
