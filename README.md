# Koya — Euclide v1.1.001

Borderless finance infrastructure. Mobile money in, Bitcoin out.

Koya converts KES to BTC via M-Pesa (Daraja STK push), with Bitcoin custody and payout through Bria/DFNS. The platform runs as a Next.js web app on Vercel and a NestJS API on AWS ECS Fargate, with full infrastructure-as-code from a blank AWS account.

**Release family:** `euclide`
**Version:** `1.1.001`

---

## Architecture

```
┌──────────────┐          ┌──────────────────────────────────────────────┐
│   Vercel     │          │  AWS                                        │
│  (Next.js)   │────API──▶│  ALB + WAF ──▶ ECS Fargate (NestJS API)    │
│  koyabank.com│          │                    │                        │
└──────────────┘          │              ┌─────┴──────┐                 │
                          │              ▼            ▼                 │
┌──────────────┐          │         PostgreSQL     Redis               │
│ WhatsApp +   │──Webhooks▶│              │                             │
│ Telegram     │          │         Secrets Manager                    │
└──────────────┘          │         CloudWatch / SNS / Alarms          │
                          └──────────────────────────────────────────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              ▼              ▼
                     Daraja (M-Pesa)   Bria (BTC)   DFNS (signing)
```

| Component | Platform | Domain |
|-----------|----------|--------|
| Web | Vercel (Next.js 16) | koyabank.com |
| API | AWS ECS Fargate (NestJS 11) | api.koyabank.com |
| Database | PostgreSQL + Prisma 7.5 | — |
| Cache | Redis (ioredis) | — |
| Payments | Safaricom M-Pesa Daraja | STK push + callbacks |
| BTC Custody | Bria (gRPC) + DFNS (signing) | UTXO / PSBT lifecycle |
| Infra | Terraform (3-layer) | AWS: VPC → platform → app |
| Ops | CloudWatch, SNS, WAF, autoscaling | Alerts + protection |

---

## Repository Layout

```
koya/
├── apps/
│   ├── web/                    # Next.js 16 App Router frontend
│   ├── api/                    # NestJS 11 backend
│   │   ├── prisma/             # Schema, migrations, config
│   │   ├── scripts/            # migrate.sh (separate ECS task)
│   │   └── src/
│   │       ├── conversion/     # Conversion engine (state machine)
│   │       ├── payments/       # M-Pesa STK push + callbacks
│   │       ├── kyc/            # Guest profiles, compliance
│   │       ├── risk/           # Validation, duplicate detection
│   │       ├── security/       # Redis rate limiting, throttle guards
│   │       ├── whatsapp/       # WhatsApp conversational flow
│   │       └── providers/      # Adapters for external services
│   └── api-e2e/                # End-to-end API tests
├── libs/
│   ├── bria-adapter/           # Bria gRPC wrapper (payout, fees, addresses, events)
│   ├── dfns-sdk/               # DFNS signing + custody integration
│   ├── types/                  # Shared TypeScript types & enums
│   ├── config/                 # App constants (currencies, branding)
│   └── ui/                     # Design token exports
├── env/
│   ├── staging.env             # Staging config (non-secret source of truth)
│   ├── production.env          # Production config
│   └── integration.env         # Local/CI config
├── infra/
│   ├── templates/              # ECS task def templates (envsubst)
│   └── secrets-map.json        # Logical secret → Secrets Manager mapping
├── terraform/aws/
│   ├── foundation/             # VPC, subnets, SGs, IAM, logs
│   ├── platform/               # ECR, ECS cluster, ALB, ACM, secrets
│   └── application/            # Task defs, service, WAF, autoscaling, alarms
├── scripts/
│   ├── bootstrap-aws.sh        # Layer-by-layer Terraform provisioning
│   ├── deploy-api.sh           # Build → push → migrate → deploy → health check
│   ├── load-env.sh             # Source + validate env file
│   ├── sync-secrets.sh         # Create/validate Secrets Manager entries
│   ├── render-task-definitions.sh
│   ├── validate-bootstrap.sh
│   └── destroy-environment.sh
├── docs/
│   ├── progress/               # Implementation history (steps 01–22)
│   └── runbooks/               # Operational runbooks
└── tasks/                      # Todo tracking & lessons learned
```

---

## Environment and Secrets Model

```
env/*.env ────────┬── scripts/load-env.sh ──── CI jobs, deploy scripts
                  ├── scripts/bootstrap-aws.sh → Terraform → AWS resources
                  └── scripts/render-task-definitions.sh → ECS task definitions

infra/secrets-map.json ── scripts/sync-secrets.sh → AWS Secrets Manager → ECS containers

Terraform outputs ── source of infra identifiers (subnets, SGs, ECR URL, cluster name)
```

| Source of Truth | Scope |
|----------------|-------|
| `env/*.env` | Non-secret configuration (ports, limits, drivers, URLs) |
| `infra/secrets-map.json` | Logical mapping of 17 secrets to Secrets Manager paths |
| AWS Secrets Manager | Actual secret values (DB URLs, API keys, certs) |
| Terraform outputs | Infrastructure identifiers (no hardcoded IDs anywhere) |

Task definitions are rendered from `infra/templates/` via `envsubst` — never edited directly.

---

## Local Development

```bash
pnpm install                # Install dependencies
pnpm dev:web                # Next.js on :3000
pnpm dev:api                # NestJS on :3333
pnpm dev                    # Both
```

Copy `.env.example` to `.env.local` for local configuration. See `env/integration.env` for the full variable reference.

```bash
# Database
cd apps/api/prisma && npx prisma migrate deploy    # Run migrations
pnpm prisma generate                                # Generate Prisma client
```

---

## Web Delivery (Vercel)

Standard Next.js on Vercel. Not Build Output API v3 — Koya has no exotic output requirements and Vercel's automatic ISR, edge middleware, and static optimization work correctly.

| Branch | Deploy |
|--------|--------|
| `develop` | Vercel preview |
| `main` | Vercel production → koyabank.com |

### Cache Strategy (3-tier)

| Tier | Routes | Cache-Control |
|------|--------|---------------|
| Public informational | `/`, `/legal/*`, content slugs | `public, max-age=0, s-maxage=60, stale-while-revalidate=30` |
| Transaction-sensitive | `/convert/*`, `/login/*`, `/overview/*` | `private, no-store` |
| Hashed static assets | `/_next/static/*` | `public, max-age=31536000, immutable` |

Configured via `headers()` in `apps/web/next.config.js`. Version keys `NEXT_PUBLIC_APP_VERSION` and `NEXT_PUBLIC_RELEASE_NAME` are set in `vercel.json` build env.

---

## API Delivery (ECS Fargate)

The API container starts with `node main.js`. Migrations do **not** run on container boot — they run as a separate, preceding ECS task.

### Deploy Flow

```
scripts/deploy-api.sh <environment> [tag] [--build]
```

1. Load env via `scripts/load-env.sh`
2. Resolve infrastructure from Terraform outputs (no hardcoded IDs)
3. Build Docker image with OCI labels (optional, `--build`)
4. Push to ECR (tagged: `$SHA`, `1.1.001`, `latest`)
5. Run migration as separate ECS task, wait for completion
6. Force new ECS service deployment
7. Health check with retries — fails if `/api/v1/health` doesn't recover

### API Hardening (Step 20)

- Helmet, trust-proxy, body limits, `x-request-id` correlation
- Redis-backed rate limiting (60 req/min/IP default, per-route decorators)
- 6-rule WAF on ALB (OWASP, bad inputs, IP reputation, rate limits)
- ECS autoscaling (CPU/memory/request-count target tracking, min 2 in production)
- 9 CloudWatch alarms → SNS (429 rate, 5xx, latency, WAF blocks, unhealthy targets)
- Graceful shutdown hooks

---

## AWS Bootstrap (Clean-Room Deploy)

Deploy Koya to a blank AWS account using the 3-layer Terraform model:

```bash
# 1. Configure environment
cp env/staging.env env/myenv.env && $EDITOR env/myenv.env

# 2. Validate
./scripts/validate-bootstrap.sh myenv

# 3. Bootstrap all infrastructure
./scripts/bootstrap-aws.sh all myenv --auto

# 4. Populate secrets
./scripts/sync-secrets.sh myenv

# 5. Build and deploy
./scripts/deploy-api.sh myenv latest --build
```

| Layer | Creates |
|-------|---------|
| `foundation` | VPC, subnets (2 public + 2 private), NAT, SGs, IAM roles, CloudWatch log groups |
| `platform` | ECR, ECS cluster, ALB, ACM cert, Route53, Secrets Manager placeholders |
| `application` | Task definitions, ECS service, WAF, autoscaling, alarms, PSBT archive (S3+KMS) |

Each layer uses S3 backend with DynamoDB locking. Downstream layers read prior state via `terraform_remote_state`.

Full guide: [docs/runbooks/aws-bootstrap.md](docs/runbooks/aws-bootstrap.md)

---

## Core Engine Flow

```
Guest → /convert (web) or WhatsApp
  → Quote (KES → BTC rate + fees, 20min TTL)
  → Identity (name, document, phone)
  → Payout address (BTC)
  → M-Pesa STK push (Daraja) → payment confirmed
  → Bria payout (gRPC) → PSBT created
  → DFNS signing → PSBT signed
  → Bria broadcast → on-chain settlement
  → Reconciliation + PSBT archival
```

15-state machine with append-only `conversion_state_events` audit trail. Channel-agnostic (WEB/WHATSAPP). Reference code format: `KYA-XXXXXXXX`.

See [docs/progress/](docs/progress/) for detailed implementation history (steps 01–22).

---

## Runbooks

| Runbook | Scope |
|---------|-------|
| [aws-bootstrap.md](docs/runbooks/aws-bootstrap.md) | Blank-account provisioning, layer-by-layer |
| [cold-start.md](docs/runbooks/cold-start.md) | First deployment from zero |
| [cold-start-checklist.md](docs/runbooks/cold-start-checklist.md) | Validation checklist |
| [environment-matrix.md](docs/runbooks/environment-matrix.md) | All env vars and secrets |
| [service-dependency-map.md](docs/runbooks/service-dependency-map.md) | Service + Terraform dependency graph |
| [api-hardening.md](docs/runbooks/api-hardening.md) | Rate limits, WAF, alarms, testing |

---

## CI/CD

Path-based pipeline (`.github/workflows/ci.yml`) using `dorny/paths-filter@v3`:

| Trigger | Paths | Action |
|---------|-------|--------|
| Web change | `apps/web/**`, `libs/ui/**`, `vercel.json` | Vercel deploy (preview or production) |
| API change | `apps/api/**`, `libs/bria-adapter/**`, `libs/dfns-sdk/**`, `env/*.env` | Docker build → ECR → migrate → ECS redeploy → health check |
| Infra change | `terraform/aws/**`, `infra/secrets-map.json` | `terraform plan` on PR (apply remains manual) |

All deploy jobs validate first (lint, typecheck, build). No hardcoded IDs — infrastructure resolved from Terraform outputs at deploy time.

---

## Key Commands

```bash
# Development
pnpm dev                                    # Web + API
pnpm nx test api                            # Unit tests (282 tests, 26 suites)
pnpm nx test api --testPathPattern="integration"  # Integration tests (needs DB+Redis)

# Quality
pnpm nx lint api && pnpm nx lint web        # Lint
pnpm typecheck                              # TypeScript strict check
pnpm format                                 # Prettier

# Infrastructure
./scripts/bootstrap-aws.sh all staging      # Provision AWS
./scripts/sync-secrets.sh staging           # Populate Secrets Manager
./scripts/validate-bootstrap.sh staging     # Validate configuration

# Deploy
./scripts/deploy-api.sh staging latest --build  # API: build + migrate + deploy
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Nx 22.5 + pnpm 10.32 |
| Web | Next.js 16.2 (App Router), Tailwind CSS v4, shadcn/ui |
| API | NestJS 11, TypeScript 5.9 (strict) |
| Database | PostgreSQL + Prisma 7.5 |
| Cache | Redis (ioredis) |
| BTC Custody | Bria (gRPC) + DFNS (signing) |
| Payments | Safaricom M-Pesa Daraja |
| Messaging | Meta WhatsApp Cloud API + Telegram |
| Infra | Terraform, ECS Fargate, ALB, WAF, CloudWatch |
| CI/CD | GitHub Actions, Vercel CLI |

---

## License

Private — All rights reserved.
