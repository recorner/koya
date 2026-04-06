# AWS Bootstrap Runbook

> Bootstrap a brand-new AWS account to run the full Koya platform.  
> **Current release:** Euclide v1.1.001

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| AWS CLI | v2+ | AWS operations |
| Terraform | >= 1.5 | Infrastructure provisioning |
| Docker | 24+ | Image builds |
| Node.js | 22 | Prisma client generation |
| pnpm | 10+ | Dependency management |
| jq | any | JSON processing |
| envsubst | any | Template rendering |

You also need:
- **AWS credentials** configured (`aws configure` or env vars)
- **Domain DNS** with a domain you control (default: `koyabank.com`)
- A **PostgreSQL database** accessible from the ECS tasks (GCP, RDS, or external)
- A **Redis instance** accessible from the ECS tasks

---

## 1. Configure Environment

```bash
# Copy and edit the environment file for your target
cp env/staging.env env/my-env.env
# Edit the file — update AWS_REGION, DOMAIN_NAME, hostnames, etc.
```

Key variables to review:
- `AWS_REGION` — target region
- `TF_STATE_BUCKET` — S3 bucket for Terraform state
- `DOMAIN_NAME` / `API_SUBDOMAIN` — DNS
- `REDIS_HOST` / `REDIS_PORT` — Redis endpoint
- `DESIRED_COUNT` — 1 for staging, 2 for production

---

## 2. Initialize Terraform Backend

```bash
./scripts/bootstrap-aws.sh init staging
```

This creates:
- S3 bucket for Terraform state (versioned, encrypted)
- DynamoDB table for state locking

---

## 3. Apply Foundation Layer

```bash
./scripts/bootstrap-aws.sh foundation staging
```

Creates:
- VPC with public + private subnets (2 AZs)
- Internet gateway, NAT gateway, route tables
- Security groups (ALB, ECS)
- IAM roles (ECS execution, API task, migrate task, GitHub Actions)
- CloudWatch log groups

---

## 4. Apply Platform Layer

```bash
./scripts/bootstrap-aws.sh platform staging
```

Creates:
- ECR repository (`koya/api`)
- ECS cluster
- ALB with HTTPS listener + HTTP→HTTPS redirect
- ACM certificate (+ DNS validation if Route53 zone provided)
- Target group (health: `/api/v1/health`)
- Secrets Manager placeholders (17 secrets)

---

## 5. Populate Secrets

```bash
# Create all missing secrets in Secrets Manager
./scripts/sync-secrets.sh staging

# Set required secrets (one at a time, from environment variables)
export DATABASE_URL='postgresql://user:pass@host:5432/koya'
./scripts/sync-secrets.sh staging --set DATABASE_URL

export REDIS_PASSWORD='your-redis-password'
./scripts/sync-secrets.sh staging --set REDIS_PASSWORD

# Repeat for all required secrets:
# MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY
# DFNS_API_KEY, DFNS_WEBHOOK_SECRET
# BRIA_API_KEY, FX_API_KEY
```

---

## 6. Build and Push Docker Image

```bash
source scripts/load-env.sh staging

# ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $(terraform -chdir=terraform/aws/platform output -raw ecr_repository_url | cut -d/ -f1)

# Build
docker build -f apps/api/Dockerfile -t koya-api .

# Tag
ECR_URL=$(terraform -chdir=terraform/aws/platform output -raw ecr_repository_url)
docker tag koya-api:latest "${ECR_URL}:latest"

# Push
docker push "${ECR_URL}:latest"
```

---

## 7. Apply Application Layer

```bash
./scripts/bootstrap-aws.sh application staging
```

Creates:
- ECS task definitions (API + migrate)
- ECS service (registered with ALB)
- WAF (6 rules: OWASP, bad inputs, IP rep, rate limits)
- Autoscaling (CPU, memory, request count)
- CloudWatch alarms (429, 5xx, latency, unhealthy, WAF blocks)
- S3 PSBT archive bucket + KMS key

---

## 8. Run Migrations and Deploy

```bash
./scripts/deploy-api.sh staging latest
```

This:
1. Resolves subnets/SGs/cluster from Terraform outputs
2. Runs the migration ECS task
3. Force-deploys the API ECS service
4. Verifies health at `https://api.koyabank.com/api/v1/health`

---

## 9. Deploy Web (Vercel)

```bash
# Link Vercel project (first time only)
cd apps/web
vercel link

# Deploy
vercel deploy --prod
```

Set Vercel environment variable:
- `NEXT_PUBLIC_API_URL` = `https://api.koyabank.com/api/v1`
- `NEXT_PUBLIC_APP_VERSION` = `1.1.001`
- `NEXT_PUBLIC_RELEASE_NAME` = `euclide`

---

## After Bootstrap: CI/CD Auto-Deploy

Once infrastructure is provisioned, the CI/CD pipeline (`.github/workflows/ci.yml`) handles deploys automatically based on which files change:

| Changed Paths | CI Job | Target |
|--------------|--------|--------|
| `apps/web/**`, `libs/ui/**`, `vercel.json` | `deploy-web-preview` / `deploy-web-production` | Vercel |
| `apps/api/**`, `libs/bria-adapter/**`, `env/*.env`, `infra/templates/**` | `deploy-api-staging` / `deploy-api-production` | ECS (Docker → ECR → migrate → deploy → health check) |
| `terraform/aws/**`, `infra/secrets-map.json` | `infra-plan` | Terraform plan (apply is manual) |

The API deploy flow:
1. AWS credentials via OIDC
2. Resolve subnets/SGs/ECR from Terraform outputs (zero hardcoded values)
3. Build Docker image with SHA + version tags
4. Push to ECR
5. Run migration ECS task, fail on non-zero exit
6. Force new ECS deployment
7. Health check with 5 retries — **workflow fails if health doesn't recover**

---

## 10. Verify

```bash
# API health
curl https://api.koyabank.com/api/v1/health

# ECS tasks running
aws ecs describe-services \
  --cluster koya-staging \
  --services koya-api-service-staging \
  --query 'services[0].{desired:desiredCount,running:runningCount,status:status}'

# CloudWatch logs
aws logs tail /ecs/koya-api-staging --since 5m
```

---

## One-Command Bootstrap

For a full bootstrap from zero:

```bash
# 1. Init + all layers
./scripts/bootstrap-aws.sh all staging --auto

# 2. Set secrets
./scripts/sync-secrets.sh staging
# ... set each secret

# 3. Build + deploy
./scripts/deploy-api.sh staging latest --build
```

---

## Teardown

### Destroy Staging

```bash
# Ordered teardown: application → platform → foundation
./scripts/destroy-environment.sh all staging
```

### Destroy Production (requires safety flag)

```bash
./scripts/destroy-environment.sh all production --confirm-production
```

### Partial Teardown

```bash
# Destroy only application layer (service, WAF, alarms)
./scripts/destroy-environment.sh application staging

# Destroy platform (ECR, ECS cluster, ALB, secrets)
./scripts/destroy-environment.sh platform staging

# Destroy foundation (VPC, subnets, SGs, IAM)
./scripts/destroy-environment.sh foundation staging
```

Note: The S3 Terraform state bucket and DynamoDB lock table are NOT destroyed by teardown. Delete them manually if needed.

---

## Recovery from Failed Bootstrap

### Terraform state corruption
```bash
# Re-init with existing state
./scripts/bootstrap-aws.sh init staging
terraform -chdir=terraform/aws/foundation init -reconfigure
```

### Partial layer failure
```bash
# Re-run the failed layer — Terraform is idempotent
./scripts/bootstrap-aws.sh platform staging
```

### Secret ARN mismatch
```bash
# Validate secrets exist
./scripts/sync-secrets.sh staging

# Recreate application layer (picks up correct ARNs)
./scripts/bootstrap-aws.sh application staging
```

### ECS service stuck
```bash
# Force redeploy
aws ecs update-service --cluster koya-staging --service koya-api-service-staging --force-new-deployment
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Terraform Layers                          │
│                                                             │
│  ┌─── Foundation ───┐  ┌─── Platform ────┐  ┌─── App ───┐ │
│  │ VPC              │  │ ECR             │  │ Task Defs  │ │
│  │ Subnets          │  │ ECS Cluster     │  │ ECS Service│ │
│  │ NAT/IGW          │  │ ALB + TLS       │  │ WAF        │ │
│  │ Security Groups  │  │ Target Group    │  │ Autoscaling│ │
│  │ IAM Roles        │  │ Secrets Manager │  │ Alarms     │ │
│  │ Log Groups       │  │ Route53/ACM     │  │ S3/KMS     │ │
│  └──────────────────┘  └────────────────┘  └────────────┘ │
│                                                             │
│  Config: env/staging.env ─────────────► Terraform vars      │
│  Secrets: infra/secrets-map.json ────► Secrets Manager      │
│  Templates: infra/templates/ ────────► Rendered task defs   │
└─────────────────────────────────────────────────────────────┘
```
