# Cold-Start Runbook — Koya Platform

**Last updated:** 2026-04-05  
**AWS Account:** 286119371044 (us-east-1)  
**Domain:** koyabank.com / api.koyabank.com

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Integration Cold Start](#2-local-integration-cold-start)
3. [Staging Cold Start](#3-staging-cold-start)
4. [Production Cold Start](#4-production-cold-start)
5. [Smoke Checks](#5-smoke-checks)
6. [Rollback Procedures](#6-rollback-procedures)

---

## 1. Prerequisites

### Tools Required

```bash
# Verify all tools are available
aws --version          # AWS CLI ≥ 1.22
docker --version       # Docker ≥ 24
docker compose version # Compose ≥ 2.20
node --version         # Node ≥ 22
pnpm --version         # pnpm ≥ 10
vercel --version       # Vercel CLI ≥ 50
```

### AWS Account Setup (one-time)

These resources were created during initial cold start and exist in `us-east-1`:

| Resource | Identifier |
|----------|-----------|
| VPC | `vpc-098dd0a4627aa9bbc` (default) |
| ECR Repository | `koya/api` |
| ECS Cluster | `koya` |
| ALB | `koya-api-alb` (DNS: `koya-api-alb-1746028093.us-east-1.elb.amazonaws.com`) |
| Target Group | `koya-api-tg` (port 3333, health: `/api/v1/health`) |
| ALB SG | `sg-0ee774be0b9af2b8e` (80, 443 inbound) |
| ECS SG | `sg-02df170a0f0b30d1f` (3333 from ALB SG) |
| Execution Role | `ecsTaskExecutionRole` |
| Task Role | `koyaApiTaskRole` (S3, CloudWatch, SNS, Logs) |
| GitHub OIDC | `github-actions-deploy` role |
| Log Group | `/ecs/koya-api` (30-day retention) |
| ACM Cert | `arn:aws:acm:us-east-1:286119371044:certificate/fec33713-35f0-4f94-8bdb-c0af3e243089` |
| S3 Buckets | `koya-archives-staging`, `koya-archives-prod` |
| KMS Key | `alias/koya-psbt-archive` (ID: `3bb67d73-c953-4d4a-8576-bdef6c6638e6`) |
| SNS Topic | `arn:aws:sns:us-east-1:286119371044:koya-ops-alarms` |

---

## 2. Local Integration Cold Start

### Purpose
Bring up the full Koya stack locally for development and integration testing.

### Step 2.1 — Clone and Install

```bash
git clone git@github.com:koyabank/koya.git && cd koya
pnpm install
```

**Expected result:** No errors, `node_modules/` populated.  
**Verify:** `pnpm nx --version`

### Step 2.2 — Environment File

```bash
cp .env.example .env.local
# Edit .env.local with your local values:
# - DATABASE_URL: your local or remote PostgreSQL
# - MPESA_DRIVER=mock (no Daraja creds needed locally)
# - BTC_DELIVERY_DRIVER=mock (no Bria/DFNS needed for basic dev)
```

### Step 2.3 — Start Infrastructure Services

```bash
docker compose up -d redis bria-pg bria
```

**Expected result:** Three containers running.  
**Verify:**
```bash
docker compose ps
# redis: healthy
# bria-pg: healthy
# bria: healthy (nc -z localhost 2742)
```

**Rollback:** `docker compose down -v`

### Step 2.4 — Database Migrations

```bash
cd apps/api
npx prisma migrate deploy --config prisma/prisma.config.ts
cd ../..
```

**Expected result:** All migrations applied.  
**Verify:** `npx prisma migrate status --config apps/api/prisma/prisma.config.ts`  
**Rollback:** Not needed — migrations are additive.

### Step 2.5 — Bria First-Time Setup (if driver=bria)

```bash
# Only needed if BTC_DELIVERY_DRIVER=bria
curl -X POST http://localhost:3333/api/v1/admin/bria/setup
```

**Expected result:** `{ "success": true }` — creates account, profile, xpub, wallet.  
**Verify:** Bria admin gRPC `listAccounts` returns koya account.

### Step 2.6 — Start API

```bash
pnpm dev:api
```

**Expected result:** NestJS listening on port 3333.  
**Verify:**
```bash
curl -s http://localhost:3333/api/v1/health | jq .
# { "status": "ok", "cache": { "status": "connected" }, ... }
```

### Step 2.7 — Start Web

```bash
pnpm dev:web
```

**Expected result:** Next.js dev server on port 3000.  
**Verify:** Open `http://localhost:3000` — landing page renders.

### Step 2.8 — Run Tests

```bash
# Unit tests (no DB required)
pnpm nx test api --testPathIgnorePatterns="integration"

# Integration tests (needs DB + Redis)
pnpm nx test api --testPathPattern="integration"

# Full integration with DFNS mock
./scripts/run-integration.sh
```

---

## 3. Staging Cold Start

### Purpose
Deploy the staging environment for QA and integration testing.

### Step 3.1 — Verify AWS Secrets

```bash
# List all Koya secrets — should return 19 entries
aws secretsmanager list-secrets \
  --region us-east-1 \
  --filters Key=name,Values=/koya/ \
  --query 'SecretList[].Name' \
  --output table
```

**Expected result:** 19 secrets listed.  
**If missing:** Create with:
```bash
aws secretsmanager create-secret \
  --region us-east-1 \
  --name "/koya/<path>" \
  --secret-string "<value>"
```

### Step 3.2 — Update Secrets with Real Values

Replace all `placeholder` values with real credentials:

```bash
# Example: Update DATABASE_URL
aws secretsmanager update-secret \
  --region us-east-1 \
  --secret-id /koya/api/DATABASE_URL \
  --secret-string "postgresql://koya:REAL_PASSWORD@167.71.173.146:25060/koya?sslmode=require"

# Repeat for each secret — see docs/runbooks/environment-matrix.md for full list
```

**Verify:**
```bash
aws secretsmanager get-secret-value \
  --region us-east-1 \
  --secret-id /koya/api/DATABASE_URL \
  --query 'SecretString' --output text | head -c 30
# Should show beginning of real connection string
```

### Step 3.3 — Verify PostgreSQL Connectivity

```bash
# From a machine with network access to GCP cassini
psql "postgresql://koya:PASSWORD@db.koyabank.com:5432/koya" -c "SELECT 1"
```

**Expected result:** Returns `1`.  
**Rollback:** Check GCP firewall rules (allow-postgres-staging), verify `pg_hba.conf`.

**Current staging DB:** GCP VM cassini at `db.koyabank.com:5432`, user=koya, db=koya.

### Step 3.4 — Validate ACM Certificate

```bash
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn arn:aws:acm:us-east-1:286119371044:certificate/fec33713-35f0-4f94-8bdb-c0af3e243089 \
  --query 'Certificate.Status'
```

**Expected result:** `"ISSUED"`

**If `PENDING_VALIDATION`:** Add the following DNS CNAME record:

| Record Name | Type | Value |
|-------------|------|-------|
| `_afcaa52d58fdc935bd65500a06913ac3.api.koyabank.com` | CNAME | `_75dd74b53756b7dd14b571b0cffe830c.jkddzztszm.acm-validations.aws` |

Then wait for validation (up to 30 minutes).

### Step 3.5 — Create HTTPS Listener (once cert is validated)

```bash
aws elbv2 create-listener \
  --region us-east-1 \
  --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:286119371044:loadbalancer/app/koya-api-alb/f242a70f5401699a \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:us-east-1:286119371044:certificate/fec33713-35f0-4f94-8bdb-c0af3e243089 \
  --default-actions "Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:286119371044:targetgroup/koya-api-tg/65c35cef2d084ca0"
```

**Verify:**
```bash
aws elbv2 describe-listeners \
  --region us-east-1 \
  --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:286119371044:loadbalancer/app/koya-api-alb/f242a70f5401699a \
  --query 'Listeners[].{Port:Port,Protocol:Protocol}'
```

### Step 3.6 — Point DNS to ALB

Add a CNAME or ALIAS record:

| Record | Type | Value |
|--------|------|-------|
| `api.koyabank.com` | CNAME | `koya-api-alb-1746028093.us-east-1.elb.amazonaws.com` |

### Step 3.7 — Build and Push API Image

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 286119371044.dkr.ecr.us-east-1.amazonaws.com

# Build from repo root
docker build -f apps/api/Dockerfile -t koya-api .

# Tag and push
docker tag koya-api:latest 286119371044.dkr.ecr.us-east-1.amazonaws.com/koya/api:latest
docker tag koya-api:latest 286119371044.dkr.ecr.us-east-1.amazonaws.com/koya/api:$(git rev-parse --short HEAD)
docker push 286119371044.dkr.ecr.us-east-1.amazonaws.com/koya/api:latest
docker push 286119371044.dkr.ecr.us-east-1.amazonaws.com/koya/api:$(git rev-parse --short HEAD)
```

**Expected result:** Image pushed to ECR.  
**Verify:**
```bash
aws ecr describe-images \
  --region us-east-1 \
  --repository-name koya/api \
  --query 'imageDetails[].imageTags'
```

### Step 3.8 — Run Database Migrations

Migrations run as a separate ECS task (not part of API container startup):

```bash
# Register migration task definition
aws ecs register-task-definition \
  --region us-east-1 \
  --cli-input-json file://infra/ecs-migrate-task-definition.json

# Run migration task
TASK_ARN=$(aws ecs run-task \
  --cluster koya-api \
  --task-definition koya-api-migrate \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --region us-east-1 \
  --query 'tasks[0].taskArn' --output text)

# Wait for completion
aws ecs wait tasks-stopped --cluster koya-api --tasks $TASK_ARN --region us-east-1

# Verify exit code
aws ecs describe-tasks \
  --cluster koya-api --tasks $TASK_ARN --region us-east-1 \
  --query 'tasks[0].containers[0].exitCode'
# Expected: 0
```

**Rollback:** Migrations are additive. Check CloudWatch logs: `/ecs/koya-api` (stream prefix: migrate).

### Step 3.9 — Scale Up ECS Service

```bash
aws ecs update-service \
  --region us-east-1 \
  --cluster koya \
  --service koya-api \
  --desired-count 1 \
  --force-new-deployment

# Watch deployment
aws ecs describe-services \
  --region us-east-1 \
  --cluster koya \
  --services koya-api \
  --query 'services[0].{desiredCount:desiredCount,runningCount:runningCount,status:status}'
```

**Expected result:** `runningCount: 1`, `status: ACTIVE`  
**Verify:**
```bash
curl -sf https://api.koyabank.com/api/v1/health | jq .
```

**Rollback:**
```bash
aws ecs update-service \
  --region us-east-1 \
  --cluster koya \
  --service koya-api \
  --desired-count 0
```

### Step 3.9 — Deploy Web (Staging)

Push to `develop` branch to trigger the CI pipeline:

```bash
git checkout develop
git push origin develop
```

The GitHub Actions `deploy-preview` job will:
1. Validate (lint, typecheck, build, test)
2. Deploy to Vercel preview URL

**Verify:** Check GitHub Actions run, click preview URL.

### Step 3.10 — Verify End-to-End

```bash
# API health
curl -sf https://api.koyabank.com/api/v1/health | jq .

# Rates health
curl -sf https://api.koyabank.com/api/v1/health/rates | jq .

# Cache health
curl -sf https://api.koyabank.com/api/v1/health/cache | jq .

# Web
curl -sf https://<preview-url>/ | head -20
```

---

## 4. Production Cold Start

### Purpose
Deploy the production environment. All steps from staging apply, with additional hardening.

### Step 4.1 — Production Secrets

Update all secrets with **production** credentials:

```bash
# Critical production overrides:
# - DATABASE_URL: production database
# - REDIS_PASSWORD: production Redis (with TLS)
# - MPESA_*: production Daraja credentials
# - DFNS mTLS certs: production certificates
# - BRIA: mainnet configuration
# - BTC_DELIVERY_DRIVER=dfns
# - MPESA_DRIVER=daraja
# - MPESA_ENVIRONMENT=production
```

### Step 4.2 — Update ECS Task Definition for Production

```bash
# Register new task definition with production-specific values
# Key changes from staging:
#   MPESA_ENVIRONMENT=production
#   MPESA_SHORTCODE=<real shortcode>
#   BRIA_WALLET_NAME=koya-mainnet
#   REDIS_TLS=true
#   CORS_ORIGINS=https://koyabank.com,https://www.koyabank.com

# Edit infra/ecs-task-definition.json then:
aws ecs register-task-definition \
  --region us-east-1 \
  --cli-input-json file://infra/ecs-task-definition.json
```

### Step 4.3 — ECS Service with ALB

Once ACM cert is validated and HTTPS listener exists, recreate service with ALB:

```bash
# Delete service without ALB
aws ecs update-service \
  --region us-east-1 \
  --cluster koya \
  --service koya-api \
  --desired-count 0

aws ecs delete-service \
  --region us-east-1 \
  --cluster koya \
  --service koya-api \
  --force

# Recreate with ALB
aws ecs create-service \
  --region us-east-1 \
  --cluster koya \
  --service-name koya-api \
  --task-definition koya-api \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0149f40803a1a3731,subnet-0dbc15fb08cda169f],securityGroups=[sg-02df170a0f0b30d1f],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:286119371044:targetgroup/koya-api-tg/65c35cef2d084ca0,containerName=koya-api,containerPort=3333" \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100"
```

### Step 4.4 — Deploy Web (Production)

Merge to `main` to trigger production deployment:

```bash
git checkout main
git merge develop
git push origin main
```

The GitHub Actions `deploy-production` job deploys to `https://koyabank.com`.

### Step 4.5 — Enable Ops Jobs

Verify the following are active in the API runtime:
- **Reconciliation cron:** daily 03:00 UTC
- **PSBT retention cron:** daily 02:00 UTC
- **Bria event consumer:** subscribing to event stream
- **Redis cursor persistence:** `koya:cursor:bria_event_consumer`

```bash
# Check app logs for cron registration
aws logs filter-log-events \
  --region us-east-1 \
  --log-group-name /ecs/koya-api \
  --filter-pattern "cron registered" \
  --limit 10
```

### Step 4.6 — Verify CloudWatch Alarms

```bash
aws cloudwatch describe-alarms \
  --region us-east-1 \
  --alarm-name-prefix Koya \
  --query 'MetricAlarms[].{Name:AlarmName,State:StateValue}'
```

**Expected result:** All alarms in `OK` or `INSUFFICIENT_DATA` state.

### Step 4.7 — Subscribe to SNS Alarms

```bash
# Email subscription example
aws sns subscribe \
  --region us-east-1 \
  --topic-arn arn:aws:sns:us-east-1:286119371044:koya-ops-alarms \
  --protocol email \
  --notification-endpoint ops@koyabank.com

# Verify subscription
aws sns list-subscriptions-by-topic \
  --region us-east-1 \
  --topic-arn arn:aws:sns:us-east-1:286119371044:koya-ops-alarms
```

### Step 4.8 — Enable Nightly Runner

Ensure the self-hosted runner EC2 instance is online:

```bash
# Verify runner is registered in GitHub
# Repository → Settings → Actions → Runners → should show "self-hosted, linux, docker"

# The nightly workflow runs automatically at 03:00 UTC
# To trigger manually:
# GitHub → Actions → nightly/dfns-integration → Run workflow
```

---

## 5. Smoke Checks

### 5.1 — API Health

```bash
curl -sf https://api.koyabank.com/api/v1/health | jq .
# Expected: { "status": "ok" }
```

### 5.2 — Web Health

```bash
curl -sf https://koyabank.com/ -o /dev/null -w "%{http_code}"
# Expected: 200
```

### 5.3 — Cache/Redis Health

```bash
curl -sf https://api.koyabank.com/api/v1/health/cache | jq .
# Expected: { "status": "connected" }
```

### 5.4 — Rates Health

```bash
curl -sf https://api.koyabank.com/api/v1/health/rates | jq .
# Expected: providers with status "available", fresh pair data
```

### 5.5 — DFNS Health

```bash
curl -sf https://api.koyabank.com/internal/health/dfns | jq .
# Expected: { "status": "ok" }
```

### 5.6 — Bria Health

```bash
# From within the network
nc -z <bria-host> 2742 && echo "Bria gRPC OK" || echo "Bria gRPC FAIL"
```

### 5.7 — Redis Cursor State

```bash
# Verify cursor is persisted (from Redis CLI or app logs)
redis-cli GET koya:cursor:bria_event_consumer
# Should return a numeric sequence ID
```

### 5.8 — Reconciliation Job

```bash
# Check last reconciliation run
aws logs filter-log-events \
  --region us-east-1 \
  --log-group-name /ecs/koya-api \
  --filter-pattern "reconciliation" \
  --limit 5
```

### 5.9 — CloudWatch Metrics

```bash
aws cloudwatch get-metric-data \
  --region us-east-1 \
  --metric-data-queries '[{
    "Id": "recon",
    "MetricStat": {
      "Metric": {
        "Namespace": "Koya/Reconciliation",
        "MetricName": "AbsDelta"
      },
      "Period": 86400,
      "Stat": "Maximum"
    }
  }]' \
  --start-time $(date -u -d "1 day ago" +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S)
```

### 5.10 — PSBT Archival Path

```bash
# Verify S3 bucket is accessible
aws s3 ls s3://koya-archives-prod/payout_psbts/ 2>&1 || echo "No archives yet (expected if new)"
```

### 5.11 — Payout Flow Readiness

```bash
# Create a test quote (use sandbox/testnet)
curl -s -X POST https://api.koyabank.com/api/v1/guest-conversion/quote \
  -H "Content-Type: application/json" \
  -d '{"sourceAsset":"KES","targetAsset":"BTC","sourceAmount":100000}' | jq .
# Should return a quote with rate, fee, and 30s TTL
```

---

## 6. Rollback Procedures

### 6.1 — Web Deployment Rollback

```bash
# List recent Vercel deployments
vercel ls --token $VERCEL_TOKEN

# Promote a previous deployment to production
vercel promote <deployment-url> --token $VERCEL_TOKEN
```

### 6.2 — ECS Service Rollback

```bash
# Roll back to previous task definition revision
PREV_REVISION=$(aws ecs describe-services \
  --region us-east-1 \
  --cluster koya \
  --services koya-api \
  --query 'services[0].taskDefinition' --output text | sed 's/:.*/:/' )

# Or explicitly:
aws ecs update-service \
  --region us-east-1 \
  --cluster koya \
  --service koya-api \
  --task-definition koya-api:<previous-revision-number>
```

### 6.3 — Secrets Rotation

```bash
# Update a secret
aws secretsmanager update-secret \
  --region us-east-1 \
  --secret-id /koya/<path> \
  --secret-string "<new-value>"

# Force ECS to pick up new secrets
aws ecs update-service \
  --region us-east-1 \
  --cluster koya \
  --service koya-api \
  --force-new-deployment
```

### 6.4 — DFNS Certificate Rotation

```bash
# Use the rotation script
./scripts/rotate-dfns-mtls.sh

# Verify
./scripts/check-cert-expiry.sh
```

### 6.5 — Driver Change Rollback

To switch BTC delivery from `dfns` back to `mock`:

1. Update ECS task definition: set `BTC_DELIVERY_DRIVER=mock`
2. Register new task definition
3. Update service with new revision
4. Verify health

```bash
# The bria event consumer stops subscribing when driver≠bria/dfns
# Existing pending deliveries will remain in DELIVERY_PENDING state
```

### 6.6 — Alerting Misconfiguration

```bash
# Disable an alarm temporarily
aws cloudwatch disable-alarm-actions \
  --region us-east-1 \
  --alarm-names "Koya-Reconciliation-AbsDelta-Warning"

# Re-enable
aws cloudwatch enable-alarm-actions \
  --region us-east-1 \
  --alarm-names "Koya-Reconciliation-AbsDelta-Warning"

# Delete and recreate if misconfigured
aws cloudwatch delete-alarms \
  --region us-east-1 \
  --alarm-names "Koya-Reconciliation-AbsDelta-Warning"
```

### 6.7 — Scale Down Emergency

```bash
# Immediate: scale to 0
aws ecs update-service \
  --region us-east-1 \
  --cluster koya \
  --service koya-api \
  --desired-count 0

# This stops all API tasks within ~30 seconds
```
