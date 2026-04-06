# Step 21 — AWS Bootstrap Engine: Blank-Account Deployability

**Date:** 2025-07-24  
**Scope:** Layered Terraform, unified env/secrets model, task definition templates, bootstrap/deploy/teardown scripts

---

## What Existed Before

- **Hardcoded infrastructure** — `infra/ecs-task-definition.json` referenced account `286119371044`, literal subnet IDs (`subnet-0a1b2c3d4e5f67890`), security group IDs
- **Empty Terraform stubs** — `terraform/aws/` had a flat directory with stub `.tf` files from Step 20 (WAF, autoscaling, alarms) but no VPC, no IAM, no ECS cluster, no ALB
- **Manual AWS setup** — `docs/runbooks/cold-start.md` documented 20+ manual console/CLI steps to create VPC, subnets, SGs, IAM roles, ECR, ECS cluster, ALB, ACM certs
- **No environment portability** — deploying to a new account required editing code, Terraform files, and task definitions with new IDs
- **No secrets management automation** — operators manually created each Secrets Manager entry
- **Deploy script hardcoded** — `scripts/deploy-api.sh` had literal values for cluster, subnets, security groups, and account ID

## What Was Added

### Part 1 — Terraform Foundation Layer (`terraform/aws/foundation/`)

6 files creating the base infrastructure a blank account needs:

| File | Creates |
|------|---------|
| `vpc.tf` | VPC, Internet Gateway, 2 public + 2 private subnets, NAT Gateway, route tables |
| `security_groups.tf` | ALB SG (80/443 inbound, 3333 to ECS) and ECS SG (3333 from ALB, DB/Redis/Bria/HTTPS/DNS egress) |
| `iam.tf` | ECS execution role (Secrets Manager + ECR + logs), API task role (S3, KMS, CloudWatch), migrate task role, GitHub Actions OIDC deploy role |
| `logs.tf` | CloudWatch log groups for API and migrate containers |
| `variables.tf` | Region, environment, VPC CIDR, AZs, subnet CIDRs, DB/Redis CIDRs, log retention |
| `outputs.tf` | All IDs exported for downstream layers |

### Part 2 — Terraform Platform Layer (`terraform/aws/platform/`)

6 files creating the container platform:

| File | Creates |
|------|---------|
| `ecs.tf` | ECR repository (keep 20 images), ECS cluster with Container Insights |
| `alb.tf` | ALB, target group (port 3333, IP target), ACM cert with DNS validation, HTTPS/HTTP listeners, Route53 alias |
| `secrets.tf` | 17 Secrets Manager entries with placeholder values (lifecycle ignores secret_string changes) |
| `variables.tf` | Domain, subdomain, Route53 zone ID, secrets map path |
| `outputs.tf` | ECR URL, cluster name/ARN, ALB details, target group, ACM ARN, secret ARNs map |

### Part 3 — Terraform Application Layer (`terraform/aws/application/`)

7 files creating the running workload and operational scaffolding:

| File | Creates |
|------|---------|
| `ecs.tf` | API task definition (25+ env vars, 9 secrets), migrate task definition, ECS service with ALB |
| `waf.tf` | 6-rule WAF (OWASP, bad inputs, IP reputation, global/conversion/webhook rate limits), ALB association, logging |
| `autoscaling.tf` | CPU, memory, and request-count target tracking; min/max configurable per environment |
| `alarms.tf` | 9 CloudWatch alarms (429 rate, 5xx, latency, unhealthy targets, WAF blocks, reconciliation, signing health) |
| `s3.tf` | PSBT archive bucket with KMS encryption, versioning, lifecycle (365d→IA, 730d expire) |
| `variables.tf` | All container, service, env, autoscaling, WAF, and alarm configuration |
| `outputs.tf` | Task def ARNs, service name, WAF ARN, S3 bucket, SNS topics |

Each layer uses S3 backend with DynamoDB locking and reads prior layer state via `terraform_remote_state`.

### Part 4 — Unified Environment Configuration (`env/`)

Three env files holding **all non-secret configuration**:

| File | Environment | Key Differences |
|------|------------|----------------|
| `env/staging.env` | Staging | `DESIRED_COUNT=1`, sandbox M-Pesa, `REDIS_TLS=false` |
| `env/production.env` | Production | `DESIRED_COUNT=2`, production M-Pesa, `REDIS_TLS=true` |
| `env/integration.env` | Local/CI | Mock drivers, localhost endpoints |

60+ variables per file. These feed into Terraform, task def rendering, and deploy scripts.

### Part 5 — Secrets Model (`infra/secrets-map.json`)

17 secrets mapped with:
- Secrets Manager path pattern: `koya/{env}/{name}`
- Description and required flag
- Consumer services list (for audit/rotation planning)

Covers: `DATABASE_URL`, `REDIS_PASSWORD`, `DARAJA_*`, `DFNS_*`, `BRIA_*`, `TWILIO_*`, `DIRECTUS_*`, `FX_API_KEY`, `SLACK_WEBHOOK_URL`

### Part 6 — Task Definition Templates (`infra/templates/`)

| Template | Placeholders | Purpose |
|----------|-------------|---------|
| `ecs-task-definition.tpl.json` | 45 `${VAR}` | API container — full env vars + secret ARNs |
| `ecs-migrate-task-definition.tpl.json` | 11 `${VAR}` | Lightweight migration runner |

Rendered via `envsubst` by `scripts/render-task-definitions.sh`.

### Part 7 — Bootstrap & Operations Scripts

| Script | Purpose |
|--------|---------|
| `scripts/bootstrap-aws.sh` | Layer-by-layer `terraform init/apply`; auto-generates `.auto.tfvars` from env; supports `--plan` and `--auto` |
| `scripts/load-env.sh` | Sources env file, validates required variables |
| `scripts/sync-secrets.sh` | Creates missing Secrets Manager entries; validates no placeholder values; supports `--set SECRET_NAME` |
| `scripts/render-task-definitions.sh` | Resolves Terraform outputs + secret ARNs, renders templates to `infra/rendered/` |
| `scripts/deploy-api.sh` | Zero-hardcoded-values deploy: loads env, resolves infra from Terraform, migrate → deploy → health check |
| `scripts/destroy-environment.sh` | Reverse-order teardown with production safety gate |
| `scripts/validate-bootstrap.sh` | Validates env files, secrets map, templates, Terraform structure, script permissions |

### Part 8 — Documentation

- **New:** `docs/runbooks/aws-bootstrap.md` — full bootstrap guide (prereqs, 10-step flow, one-command path, teardown, recovery)
- **Updated:** `docs/runbooks/cold-start.md` — automated bootstrap section added at top
- **Updated:** `docs/runbooks/cold-start-checklist.md` — automated validation section
- **Updated:** `docs/runbooks/environment-matrix.md` — env files as source of truth
- **Updated:** `docs/runbooks/service-dependency-map.md` — Terraform layer dependency table
- **Updated:** `docs/deployment/ecs-fargate.md` — automated deployment section

## Operator Workflow

### New Account (blank AWS):
```bash
# 1. Configure environment
cp env/staging.env env/myenv.env && $EDITOR env/myenv.env

# 2. Validate configuration
./scripts/validate-bootstrap.sh myenv

# 3. Bootstrap all infrastructure
./scripts/bootstrap-aws.sh all myenv --auto

# 4. Populate secrets
./scripts/sync-secrets.sh myenv
# Set each secret via AWS Console or --set flag

# 5. Build and deploy
./scripts/deploy-api.sh myenv latest --build
```

### Existing Account (infrastructure already exists):
```bash
# Just deploy
./scripts/deploy-api.sh staging latest --build
```

### Teardown:
```bash
./scripts/destroy-environment.sh staging all
```

## What Prevented Blank-Account Bootstrap Before

1. **No VPC/networking IaC** — subnets, NAT, route tables were manual
2. **No IAM IaC** — roles hand-created in console, ARNs pasted into task defs
3. **No ALB/ACM IaC** — load balancer and cert created manually
4. **Hardcoded identifiers** — account IDs, subnet IDs, SG IDs baked into JSON and scripts
5. **No environment abstraction** — staging/production differences scattered across files
6. **No secrets automation** — each secret manually created and populated
7. **No layered state** — no way to manage infrastructure lifecycle (create/update/destroy) safely

## What Is Still Deferred

- **Multi-region** — current design is single-region; adding a second region requires VPC peering or Transit Gateway
- **Terraform Cloud/Spacelift** — state is in S3; managed Terraform workflow can be added later
- **CI-driven bootstrap** — `bootstrap-aws.sh` runs locally; GitHub Actions workflow can wrap it
- **Blue/green deployments** — ECS rolling update is sufficient for now; CodeDeploy integration deferred
- **RDS provisioning** — database remains on managed GCP; Terraform RDS module ready when migration planned
- **Redis provisioning** — ElastiCache module deferred; Redis remains on managed GCP
