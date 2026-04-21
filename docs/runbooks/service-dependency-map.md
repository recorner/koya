# Service Dependency Map

**Last updated:** 2026-04-21

---

## Service Inventory

| # | Service | Environment | Owner | Health Endpoint | Notes |
|---|---------|-------------|-------|-----------------|-------|
| 1 | **PostgreSQL** (GCP cassini / staging) | staging | Platform | `pg_isready` | GCP VM 34.79.165.195:5432, db.koyabank.com |
| 1b | **PostgreSQL** (AWS managed / prod) | prod | Platform | `pg_isready` | TBD — RDS or Aurora |
| 2 | **Redis** (GCP cassini / staging) | staging | Platform | `redis-cli ping`, `GET /api/v1/health/cache` | GCP VM 34.79.165.195:6379, redis.koyabank.com |
| 3 | **Bria PostgreSQL** | all | Platform | `pg_isready -U bria` | Dedicated PG 16 for Bria (not PG 18—uuid bug) |
| 4 | **Bria** (BTC custody) | all | Platform | `nc -z localhost 2742` | gRPC on 2742 (API), 2743 (Admin) |
| 5 | **DFNS** (signing) | staging, prod | External | `GET /internal/health/dfns` | mTLS required in prod, API-key in sandbox |
| 6 | **NestJS API** | all | Backend | `GET /api/v1/health` | ECS Fargate in prod, Docker local |
| 7 | **Next.js Web** | all | Frontend | HTTP 200 on `/` | Vercel in staging/prod, `next dev` local |
| 8 | **Daraja / M-Pesa** | staging, prod | External | OAuth token fetch | Safaricom sandbox/production |
| 9 | **Directus CMS** | staging, prod | Platform | `GET /server/health` | SQLite backend, Docker |
| 10 | **Meta WhatsApp Cloud + Telegram** | staging, prod | External | — | Webhook-driven messaging providers |
| 11 | **Binance/Kraken** (rates) | all | External | `GET /api/v1/health/rates` | Rate providers with fallback |
| 12 | **GitHub Actions** | CI | DevOps | — | CI/CD pipeline |
| 13 | **Self-Hosted Runner** | CI | DevOps | — | EC2 t3.medium for nightly DFNS integration |
| 14 | **Vercel** | staging, prod | DevOps | — | Web deployment target |
| 15 | **ECR** | prod | DevOps | — | Docker image registry for API |
| 16 | **ECS Fargate** | prod | DevOps | — | API compute |
| 17 | **ALB** | prod | DevOps | — | api.koyabank.com HTTPS termination |
| 18 | **Secrets Manager** | prod, CI | DevOps | — | All runtime secrets |
| 19 | **S3** | staging, prod | DevOps | — | PSBT archival (`koya-archives-{env}`) |
| 20 | **KMS** | staging, prod | DevOps | — | PSBT encryption (alias/koya-psbt-archive) |
| 21 | **CloudWatch** | prod | DevOps | — | Metrics + Alarms |
| 22 | **SNS** | prod | DevOps | — | Alarm notifications (`koya-ops-alarms`) |

---

## Dependency Graph

```
                   ┌──────────────┐
                   │   Internet   │
                   └──────┬───────┘
                          │
              ┌───────────┴───────────┐
              │                       │
        ┌─────▼─────┐         ┌──────▼──────┐
        │  Vercel    │         │    ALB      │
        │  (Web)     │         │  (HTTPS)    │
        └─────┬─────┘         └──────┬──────┘
              │                      │
              │               ┌──────▼──────┐
              │               │  ECS Fargate │
              │               │  (NestJS API)│
              │               └──┬──┬──┬──┬─┘
              │                  │  │  │  │
     ┌────────┘    ┌─────────────┘  │  │  └──────────────┐
     │             │                │  │                  │
┌────▼────┐  ┌─────▼─────┐  ┌──────▼──┐  ┌────────┐  ┌──▼───────┐
│ Directus│  │ PostgreSQL │  │  Redis  │  │  Bria  │  │  DFNS    │
│  (CMS)  │  │  (GCP)     │  │  (GCP)  │  │ (gRPC) │  │ (mTLS)   │
└─────────┘  └────────────┘  └─────────┘  └───┬────┘  └──────────┘
                                               │
                                          ┌────▼────┐
                                          │ Bria PG │
                                          │ (PG 16) │
                                          └─────────┘
```

### External API Dependencies

```
API ──► Safaricom Daraja (M-Pesa STK push + callbacks)
API ──► Binance API (BTC/USD, BTC/USDT rates)
API ──► Kraken API (BTC/USD rates)
API ──► FX API (KES/USD rate)
API ──► Meta WhatsApp Cloud API (messaging + webhook)
API ──► Telegram Bot API (messaging + webhook)
API ──► DFNS API (PSBT signing, webhook)
API ──► Bria (gRPC: payout, address, events)
```

---

## Startup Dependency Order

### Local Integration

```
1. Docker network (created by compose)
2. Redis (no deps)
3. Bria PostgreSQL (no deps)
4. Bria (needs: Bria PG)
5. Primary PostgreSQL (external, already running)
6. API (needs: PostgreSQL, Redis, Bria)
7. DFNS Mock (optional, for integration tests)
8. Web (needs: API URL)
```

### Staging

```
1. Secrets Manager (pre-populated)
2. Primary PostgreSQL (GCP cassini — db.koyabank.com:5432)
3. Redis (GCP cassini — redis.koyabank.com:6379, password auth)
4. Bria PostgreSQL (Docker on cassini)
5. Bria (needs: Bria PG, secrets)
6. DFNS connectivity verified (sandbox API key — api.dfns.ninja)
7. ECS service → API (needs: all above + DB migrations)
8. Vercel → Web (develop branch deploy)
9. Ops jobs (cron: reconciliation, retention)
10. Smoke checks
```

### Production

```
1. Secrets Manager (all secrets with real values)
2. Primary PostgreSQL (DigitalOcean — always on)
3. Redis (ElastiCache with auth + TLS)
4. Bria PostgreSQL (dedicated managed instance)
5. Bria (private config; network from `BTC_PRODUCTION_NETWORK_MODE`)
6. DFNS connectivity verified (mTLS required)
7. ACM certificate validated for api.koyabank.com
8. ALB HTTPS listener active
9. ECR image pushed
10. ECS task definition registered
11. ECS service scaled to desired-count=2
12. Prisma migrations run (on container startup)
13. API health verified (GET /api/v1/health)
14. Vercel → Web (main branch deploy to koyabank.com)
15. Ops jobs active (reconciliation 03:00, retention 02:00)
16. CloudWatch alarms in OK state
17. SNS subscribers confirmed
18. Nightly runner workflow enabled
```

---

## Port Map

| Service | Port | Protocol | Scope |
|---------|------|----------|-------|
| NestJS API | 3333 | HTTP | Internal (ALB → ECS) |
| Bria API | 2742 | gRPC | Internal |
| Bria Admin | 2743 | gRPC | Internal |
| Bria PostgreSQL | 5433 | TCP | Internal |
| Redis | 6379 | TCP | Internal |
| Primary PostgreSQL | 5432 | TCP | External (db.koyabank.com / GCP staging) |
| Directus | 8055 | HTTP | Internal |
| DFNS Mock | 4444 | HTTP | Local only |
| Next.js Dev | 3000 | HTTP | Local only |
| ALB | 443 | HTTPS | Public |
| ALB | 80 | HTTP→301 | Public (redirect) |

---

## Infrastructure as Code

### Terraform Layers

| Layer | Path | Creates |
|-------|------|---------|
| Foundation | `terraform/aws/foundation/` | VPC, subnets, NAT, IGW, SGs, IAM, log groups |
| Platform | `terraform/aws/platform/` | ECR, ECS cluster, ALB, ACM, Route53, Secrets Manager |
| Application | `terraform/aws/application/` | Task defs, ECS service, WAF, autoscaling, alarms, S3/KMS |

Apply in order: foundation → platform → application
Destroy in reverse: application → platform → foundation
