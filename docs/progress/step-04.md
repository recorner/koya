# Step 04 — CI/CD Pipeline

**Status:** Complete  
**Date:** 2026-03-10

---

## Scope

Production-grade CI/CD pipeline for the Koya monorepo using GitHub Actions and Vercel deployment.

---

## Branch & Deployment Strategy

| Branch | Trigger | Action |
|--------|---------|--------|
| `main` | Push | Validate → Deploy to **Vercel production** |
| `develop` | Push | Validate → Deploy to **Vercel preview** (staging) |
| PR → `main` | PR opened/sync | Validate → Deploy to **Vercel preview** |
| PR → `develop` | PR opened/sync | Validate → Deploy to **Vercel preview** |

**Branch model:**
- `main` — production; always deployable
- `develop` — staging/integration; preview deploys for testing
- Feature branches — created from `develop`, merged via PR

**Recommended branch protection rules (GitHub settings):**
- `main`: require PR, require status checks (Validate), no direct push
- `develop`: require status checks (Validate)

---

## Workflow File

**`.github/workflows/ci.yml`** — single unified pipeline with 3 jobs:

### Job 1: `validate`

Runs on **all** pushes to main/develop and all PRs.

| Step | Command | Purpose |
|------|---------|---------|
| Format check | `pnpm format:check` | Prettier conformance |
| Lint | `pnpm lint` | ESLint across all 6 Nx projects |
| Typecheck | `pnpm typecheck` | TypeScript strict check (web + api) |
| Build web | `pnpm nx build web` | Next.js production build |
| Build API | `pnpm nx build api` | NestJS production build |

### Job 2: `deploy-preview`

Runs on PRs and pushes to `develop`. Requires `validate` to pass.

- Pulls Vercel project config (preview environment)
- Builds via Vercel CLI (uses `vercel.json` → `npx nx build web`)
- Deploys to a unique preview URL
- Preview URL is surfaced in the GitHub environment

### Job 3: `deploy-production`

Runs on pushes to `main` only. Requires `validate` to pass.

- Pulls Vercel project config (production environment)
- Builds via Vercel CLI with `--prod` flag
- Deploys to `https://koyabank.com`

---

## Required GitHub Secrets

| Secret | Where to find | Used by |
|--------|--------------|---------|
| `VERCEL_TOKEN` | [Vercel → Settings → Tokens](https://vercel.com/account/tokens) | All deploy jobs |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `vercel link` (or Vercel dashboard → Settings → General → Team ID) | All deploy jobs |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after `vercel link` (or Vercel dashboard → Project → Settings → General → Project ID) | All deploy jobs |

To obtain `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` locally:
```bash
cd apps/web
npx vercel link
cat .vercel/project.json
```

These values go into **GitHub → Repository → Settings → Secrets and variables → Actions**.

---

## Files Created / Modified

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | New — CI/CD pipeline |
| `.nvmrc` | New — pins Node 22 for CI and local dev |
| `package.json` | Modified — fixed `typecheck` script, added `packageManager`, added `engines` |

### `package.json` changes

- **`typecheck` script fixed:** was `tsc --noEmit` (broken — no root `tsconfig.json`), now explicitly checks both app tsconfigs: `tsc --noEmit -p apps/web/tsconfig.json && tsc --noEmit -p apps/api/tsconfig.app.json`
- **`packageManager` added:** `pnpm@10.32.0` — enables Corepack and lets `pnpm/action-setup` auto-detect version
- **`engines` added:** `node >=22.0.0, pnpm >=10.0.0` — guards against wrong runtime versions

---

## Vercel Configuration

The existing `vercel.json` is used as-is:
```json
{
  "buildCommand": "npx nx build web",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "framework": "nextjs"
}
```

**Important:** If Vercel's Git integration is auto-deploying from the GitHub repo, disable it in Vercel project settings (Settings → Git → Connected Git Repository → disconnect or disable auto-deploy). Otherwise, both GitHub Actions and Vercel will deploy simultaneously, causing duplicate deploys.

---

## CI Features

- **Dependency caching:** pnpm store is cached via `actions/setup-node` cache option
- **Concurrency control:** concurrent runs on the same ref are cancelled for PRs; branch pushes are queued
- **Nx-aware:** uses Nx targets (`nx build web`, `nx build api`, `nx run-many -t lint`)
- **Pinned versions:** Node from `.nvmrc`, pnpm from `packageManager` field
- **Frozen lockfile:** `pnpm install --frozen-lockfile` prevents lockfile drift
- **GitHub Environments:** `preview` and `production` environments with deployment URLs

---

## What Is NOT Included (Deferred)

| Item | Reason |
|------|--------|
| **Unit tests** | No test targets exist on any project. `jest.preset.js` is missing. When tests are added, uncomment the test step in CI. |
| **E2E tests** | `api-e2e` has a Jest config referencing missing `jest.preset.js`. Needs setup before it can run. |
| **API deployment** | API is NestJS targeting AWS ECS Fargate (per plan.md). Not a Vercel deployment. Deferred until backend infrastructure is ready. |
| **Nx remote caching** | Nx Cloud / remote cache not configured. Can be added later for faster CI on larger projects. |
| **Docker builds** | Containerization deferred per step-01 to step 4+. |
| **Slack / Discord notifications** | No notification integrations. Can be added as a post-deploy step. |

---

## Pre-Flight Checklist

Before the first CI run succeeds:

1. **Set GitHub Secrets** — `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
2. **Run `pnpm format`** — some files currently don't pass Prettier check; run format before pushing
3. **Disable Vercel auto-deploy** — if Git integration is connected, disable to avoid duplicate deploys
4. **Create `develop` branch** — if not already present, for the staging flow
5. **Set branch protection** — recommended: require PR + status checks for `main`
