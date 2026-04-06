# Step 22 — Euclide v1.1.001: Web + API Delivery Pattern

**Date:** 2026-04-06  
**Scope:** Vercel cache policy, frontend persistence discipline, path-based CI/CD, API auto-deploy, release identity, unified env loading

---

## What Existed Before

- **CI workflow deployed everything on every push** — no path filtering; web and API deployed together regardless of which files changed
- **No API deploy in CI** — only Vercel (web) deployments were automated; API deploys were manual via `scripts/deploy-api.sh`
- **No cache headers** — Vercel served Next.js defaults; no explicit CDN/browser cache policy for public vs. sensitive pages
- **No release identity** — no version or release family exposed in health endpoints, env vars, Docker labels, or build metadata
- **No frontend persistence discipline** — no documented cache-buster pattern, no version key for client state

## What Was Added

### Part 1 — Vercel Cache/Header Policy (`apps/web/next.config.js`)

Three-tier cache strategy via Next.js `headers()`:

| Tier | Routes | Cache-Control |
|------|--------|---------------|
| **Public informational** | `/`, `/legal/*`, CMS slug pages | `public, max-age=0, s-maxage=60, stale-while-revalidate=30` |
| **Authenticated / transaction-sensitive** | `/convert/*`, `/login/*`, `/overview/*` | `private, no-store` |
| **Hashed static assets** | `/_next/static/*` | `public, max-age=31536000, immutable` |

**Why standard Next.js on Vercel (not Build Output API v3):**
- Koya's web app is a standard Next.js App Router project with no exotic output requirements
- Build Output API v3 adds complexity (manual route manifests, function configs) with zero benefit for our use case
- Vercel's automatic ISR, edge middleware, and static optimization already work correctly
- Custom cache headers via `next.config.js` provide precise control without framework migration

### Part 2 — Frontend Cache Persistence Discipline

**Version keys added:**
- `NEXT_PUBLIC_APP_VERSION=1.1.001` — cache-buster for client persisted data
- `NEXT_PUBLIC_RELEASE_NAME=euclide` — release family identifier

Set in: `vercel.json` build env, `.env.example`, CI workflow env

**Persistence guidance:**

| Data Class | Stale Time | Persist? | Notes |
|-----------|-----------|----------|-------|
| CMS/public content | 60s CDN, 30s SWR | No client persist | Server-fetched, CDN-cached |
| Rates data | Real-time (SSE) | Never persist | Always live from backend |
| Static metadata (feature flags) | Until version bump | Key by `APP_VERSION` | Invalidated on deploy |
| Auth/session state | Session-scoped | Never persist | `private, no-store` |
| Active conversion/payment state | Request-scoped | Never persist | Server-authoritative |
| Payout-sensitive data | Never cache | Never persist | `private, no-store` |

### Part 3 — CI Path-Based Change Detection (`.github/workflows/ci.yml`)

Added `detect-changes` job using `dorny/paths-filter@v3`:

| Component | Trigger Paths |
|-----------|--------------|
| **Web** | `apps/web/**`, `libs/ui/**`, `libs/types/**`, `vercel.json`, web config files |
| **API** | `apps/api/**`, `libs/bria-adapter/**`, `libs/config/**`, `libs/types/**`, `libs/dfns-sdk/**`, `scripts/deploy-api.sh`, `env/*.env`, `infra/templates/**` |
| **Infra** | `terraform/aws/**`, `infra/secrets-map.json`, bootstrap/render/sync scripts, `env/*.env` |

Deploy jobs now gate on their respective change detection outputs.

### Part 4 — API Redeploy Flow

New CI jobs `deploy-api-staging` and `deploy-api-production`:

1. ✅ Validate (existing `validate` job)
2. ✅ Configure AWS credentials via OIDC
3. ✅ Login to ECR
4. ✅ Resolve infrastructure from Terraform outputs (no hardcoded values)
5. ✅ Build Docker image with OCI labels (revision, version, title, description)
6. ✅ Tag image with `$GITHUB_SHA`, `1.1.001`, and `latest`
7. ✅ Push to ECR
8. ✅ Run migration task (separate ECS task, check exit code)
9. ✅ Force new deployment on ECS service
10. ✅ Health check with retries (5 attempts, 15s intervals) — **fails the workflow** if health doesn't recover

Migrations do **not** run at container startup — they run as a preceding ECS task.

### Part 5 — Unified Env/Secrets Loading

- CI loads env via `source scripts/load-env.sh <env>` — single source of truth
- No hardcoded account IDs, cluster names, subnet IDs, or SG IDs in workflow YAML
- Infrastructure identifiers resolved from Terraform outputs at deploy time
- Secrets flow: AWS Secrets Manager → ECS task definition → container env
- Non-secrets flow: `env/*.env` → Terraform vars / task def rendering / CI

### Part 6 — Release Identity

Release `euclide` / `1.1.001` propagated to:

| Surface | Mechanism |
|---------|-----------|
| Web env | `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_RELEASE_NAME` in `vercel.json` build env + CI env |
| API env | `RELEASE_FAMILY`, `RELEASE_VERSION` in ECS task def env vars |
| API health | `/api/v1/health` response includes `release` and `version` fields |
| Docker image | OCI labels: `org.opencontainers.image.version`, `org.opencontainers.image.description` |
| Image tags | `<ecr>:1.1.001` alongside `<ecr>:<sha>` and `<ecr>:latest` |
| Env files | `RELEASE_FAMILY` + `RELEASE_VERSION` in `env/staging.env`, `env/production.env`, `env/integration.env` |
| CI workflow | `RELEASE_FAMILY` + `RELEASE_VERSION` as top-level workflow env vars |

### Part 7 — Infra Terraform Plan in CI

New `infra-plan` job runs `terraform plan` on PRs when infrastructure files change. Apply remains manual (via `bootstrap-aws.sh`).

## How GitHub, Vercel, AWS, Terraform, Env Files, and Secrets Manager Stay Synced

```
env/staging.env ──┬── scripts/load-env.sh ──── CI jobs (deploy-api-*, infra-plan)
                  ├── scripts/bootstrap-aws.sh → Terraform → AWS resources
                  └── scripts/render-task-definitions.sh → ECS task defs

infra/secrets-map.json ──── scripts/sync-secrets.sh → AWS Secrets Manager → ECS task def secrets

vercel.json ──── Vercel CLI (deploy-web-*) → Vercel CDN

.github/workflows/ci.yml ──── GitHub Actions → orchestrates all of the above
```

**Contract:**
- `env/*.env` = single source of truth for non-secret config
- AWS Secrets Manager = single source of truth for secrets
- Terraform outputs = source of infra identifiers (subnets, SGs, ECR URLs)
- Task definitions = always rendered from `infra/templates/` via `envsubst`

## Files Changed

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Full refactor: path detection, web/API/infra split, API deploy flow |
| `apps/web/next.config.js` | Added `headers()` with 3-tier cache policy |
| `apps/web/project.json` | Added explicit build target with `NODE_ENV=production` env |
| `apps/web/app/not-found.tsx` | Custom 404 page for Next.js App Router |
| `.nxignore` | Exclude `scripts/dfns-mock` from Nx project graph |
| `vercel.json` | Added `build.env` with release vars and `NODE_ENV` |
| `apps/api/src/app/app.service.ts` | Health endpoint returns `release` + `version` |
| `infra/templates/ecs-task-definition.tpl.json` | Added `RELEASE_FAMILY` + `RELEASE_VERSION` env vars |
| `env/staging.env` | Added `RELEASE_FAMILY` + `RELEASE_VERSION` |
| `env/production.env` | Added `RELEASE_FAMILY` + `RELEASE_VERSION` |
| `env/integration.env` | Added `RELEASE_FAMILY` + `RELEASE_VERSION` |
| `.env.example` | Added `NEXT_PUBLIC_APP_VERSION` + `NEXT_PUBLIC_RELEASE_NAME` |
| `package.json` | Next.js upgraded to 16.2.2, added `express` |
| `docs/progress/step-22.md` | This file |
| `docs/runbooks/cold-start.md` | Updated with Euclide release pattern |
| `docs/runbooks/aws-bootstrap.md` | Updated with CI deploy flow |
| `docs/runbooks/environment-matrix.md` | Updated with release identity vars |
| `tasks/lessons.md` | Added 6 new lessons from this session |

## Acceptance Criteria — Met

- ✅ Vercel web deploy remains standard Next.js with explicit cache strategy
- ✅ Frontend persistence has documented/versioned cache-buster pattern
- ✅ Pushes trigger correct deploy behavior automatically (path-based)
- ✅ API changes rebuild/push/redeploy ECS with health check
- ✅ Env files are the single non-secret source of truth
- ✅ Release `euclide` / `1.1.001` is visible and documented
- ✅ Runbooks reflect the final operating model

## Deployment Verification

### Live Site (koyabank.com)

Deployed via `vercel build --prod` → `vercel deploy --prebuilt --prod` on 2026-04-06.

**Cache header verification:**

| Route | Expected | Actual |
|-------|----------|--------|
| `/` | `public, max-age=0, s-maxage=60, stale-while-revalidate=30` | ✅ Match |
| `/convert` | `private, no-cache, no-store` | ✅ Match |
| `/login` | `private, no-store` | ✅ Match |
| `/overview` | `private, no-store` | ✅ Match |

### GitHub Secrets Configured

| Secret | Repo | Status |
|--------|------|--------|
| `VERCEL_ORG_ID` | `westronet/koya` | ✅ Set (team_QiK…) |
| `VERCEL_PROJECT_ID` | `westronet/koya` | ✅ Set (prj_LVrs…) |
| `VERCEL_TOKEN` | `westronet/koya` | ✅ Set |

CI pipeline is fully wired for automated Vercel deploys on push.

## Build Issues Resolved

### Next.js 16 + Nx: `_global-error` Prerender Crash

**Symptom:** `pnpm nx build web` failed with `TypeError: Cannot read properties of null (reading 'useContext')` in Next.js internal `_global-error` page prerender.

**Root cause:** Nx `run-commands` executor doesn't set `NODE_ENV`. Next.js 16 treats unset `NODE_ENV` as "non-standard" and the `_global-error` prerender path crashes without it.

**Fix:** Set `NODE_ENV=production` explicitly in:
- `apps/web/project.json` build target env
- `vercel.json` build env

### Vercel Non-Prebuilt Deploy Failure

**Symptom:** `vercel deploy --prod` fails with "Unexpected error" on the monorepo.

**Fix:** Use prebuilt pattern: `vercel build --prod` → `vercel deploy --prebuilt --prod`. CI workflow already uses this pattern.

### Next.js Upgraded to 16.2.2

Upgraded from 16.1.7 during debugging. The `_global-error` crash existed in both versions — resolved by the `NODE_ENV` fix, not the upgrade.
