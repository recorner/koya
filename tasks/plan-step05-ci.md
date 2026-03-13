# Plan: Step 05 Docs, CI Tests, API Deployment Strategy

## Context
- Step 05 (Guest Conversion Engine + DB + Testing) is complete
- All tests pass: 45 unit/integration + 17 E2E = 62 total
- Frontend → Vercel (already deployed)
- API → needs deployment target (AWS ECS Fargate per plan.md)
- CI currently has NO test step — needs adding

## Tasks

### 1. Create `docs/progress/step-05.md`
Document everything built in Step 05:
- Database setup (DigitalOcean PostgreSQL, Prisma v7 driver adapter)
- Swap mock provider
- Integration tests (12 tests via NestJS TestingModule)
- E2E tests (17 tests via axios against running server)
- Jest infrastructure (config, uuid ESM fix, timeout tuning)

### 2. Update `tasks/todo.md`
- Mark Phase 7 (7.2, 7.3) as complete
- Add Swap provider to Phase 4 as 4.6

### 3. Add test step to CI pipeline (`.github/workflows/ci.yml`)
- Unit tests run in CI (no DB required — mock providers)
- Integration tests need DB — either:
  a. Skip in CI (run locally only) — simplest for now
  b. Add PostgreSQL service container — proper but complex
- E2E tests need running server — skip in CI for now
- **Decision:** Run unit tests only in CI. Integration/E2E tests run locally.
- Add: `pnpm nx test api --testPathIgnorePatterns="integration"` to validate job

### 4. API Deployment Strategy (document, don't implement yet)
Per plan.md: "AWS ECS Fargate" for the API.
Reality check for testing:
- **Local:** `nx serve api` → test with curl/Postman/E2E suite
- **CI:** Unit tests run without DB, integration tests need DB service
- **Staging:** Deploy API to ECS Fargate with DigitalOcean DB
- **Production:** Same ECS Fargate setup

Future steps (not now):
- Dockerfile for API
- ECS task definition
- GitHub Actions deploy-api job
- AWS secrets (DATABASE_URL, etc.)

### 5. Create `tasks/lessons.md`
Capture learnings from this session for self-improvement loop.

## Order of Execution
1 → 2 → 3 → 5 → done (4 is documentation only, included in step-05.md)
