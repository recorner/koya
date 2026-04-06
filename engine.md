# Dev Prompt — Euclide v1.1.001 Web + API Delivery Pattern

## Goal
Finalize the Koya release pattern for **Euclide v1.1.001** so that:
- Vercel is optimized for the Next.js web app
- ECS deploys the API automatically when backend changes land
- GitHub, Vercel, AWS, Terraform, env files, and Secrets Manager stay aligned
- a push to `develop` or `main` deploys the correct components automatically

## Read first
- `vercel.json`
- `.github/workflows/ci.yml`
- `docs/progress/step-04.md`
- `docs/progress/step-20.md`
- `docs/progress/step-21.md`
- `docs/runbooks/cold-start.md`
- `docs/runbooks/aws-bootstrap.md`
- `env/staging.env`
- `env/production.env`
- `scripts/deploy-api.sh`
- `scripts/bootstrap-aws.sh`
- `apps/api/Dockerfile`

## Part 1 — Keep Vercel simple, optimize caching
Do **not** migrate Koya to Build Output API v3 or dual `vercel.json`.
Keep standard Next.js deployment on Vercel.

### Required changes
1. Keep `framework: "nextjs"` in `vercel.json`
2. Add explicit cache/header policy using standard Next.js route headers:
   - public informational pages: `public, max-age=0, s-maxage=60, stale-while-revalidate=30`
   - authenticated/transaction-sensitive pages: `private, no-store`
   - hashed static assets: `public, max-age=31536000, immutable`
3. Document which routes/pages belong to each cache class
4. Do not cache sensitive conversion/session pages at CDN/browser layer

## Part 2 — Frontend cache persistence discipline
Implement or document a client cache policy:
1. add `NEXT_PUBLIC_APP_VERSION=1.1.001`
2. add `NEXT_PUBLIC_RELEASE_NAME=euclide`
3. add a cache-buster/persistence version key for frontend persisted query state
4. ensure sensitive keys are never persisted:
   - auth/session
   - active conversion/payment state
   - payout-sensitive data
5. document stale time and persistence guidance for:
   - CMS/public content
   - rates data
   - static metadata
   - user-sensitive data

## Part 3 — GitHub Actions split by changed paths
Refactor `.github/workflows/ci.yml` so it can detect which parts changed.

### Web deploy should run when:
- `apps/web/**`
- shared frontend libs
- `vercel.json`
- frontend config/caching files

### API build/deploy should run when:
- `apps/api/**`
- backend/shared libs used by API
- `apps/api/Dockerfile`
- `infra/templates/**`
- `scripts/deploy-api.sh`
- `env/*.env`
- relevant `terraform/aws/application/**`
- relevant `terraform/aws/platform/**`
- security / DFNS / Bria / Daraja code changes

### Infra apply should run when:
- `terraform/aws/**`
- `infra/secrets-map.json`
- bootstrap/render scripts
- env files that affect infrastructure

Prefer path filters or Nx affected logic.

## Part 4 — API redeploy flow
When API changes:
1. validate
2. build Docker image
3. tag image with commit SHA and optionally `1.1.001`
4. push to ECR
5. run `scripts/deploy-api.sh <env> <image-tag>`
6. migration task runs first
7. ECS service redeploys
8. `/api/v1/health` is checked
9. fail the workflow if health does not recover

Do not reintroduce runtime migrations into normal API startup.

## Part 5 — Unified env/secrets loading
Keep this contract:
- `env/staging.env` and `env/production.env` are the **single source of truth for non-secret config**
- AWS Secrets Manager is the **single source of truth for secrets**
- Terraform outputs are the source of infra identifiers
- task definitions are always rendered from templates

### Requirements
- GitHub Actions should load one env file once
- no hardcoded account IDs, cluster names, subnet IDs, SG IDs in workflow steps
- no duplicated non-secret config in workflow YAML

## Part 6 — Release identity
Set and propagate:
- release family: `euclide`
- version: `1.1.001`

Expose in:
- web env
- API env
- build metadata
- image tags
- logs
- docs/runbooks

## Part 7 — Docs
Update:
- `docs/runbooks/cold-start.md`
- `docs/runbooks/aws-bootstrap.md`
- `docs/runbooks/environment-matrix.md`
- `docs/progress/step-22.md` (new)

Document:
- why Koya keeps standard Next.js on Vercel instead of Build Output API v3
- cache policy matrix
- which changes trigger web deploy vs API deploy vs infra apply
- how GitHub, Vercel, AWS, Terraform, env files, and Secrets Manager stay synced
- Euclide v1.1.001 release pattern

## Part 8 — Acceptance criteria
This task is done when:
- Vercel web deploy remains standard Next.js and has an explicit cache strategy
- frontend persistence has a documented/versioned cache-buster pattern
- pushes trigger the correct deploy behavior automatically
- API changes rebuild/push/redeploy ECS when needed
- env files are the single non-secret source of truth
- release `euclide` / `1.1.001` is visible and documented
- runbooks reflect the final operating model