# Lessons Learned

Patterns and fixes to remember. Updated after corrections or hard-won debugging sessions.

---

## Prisma v7 — No `datasourceUrl` in Constructor

Prisma v7 removed `datasourceUrl` from the `PrismaClient` constructor. Must use a driver adapter:

```ts
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } });
super({ adapter });
```

Also: `prisma.config.ts` uses `datasource.url` (not `migrate.url`).

---

## pg v8 SSL — `sslmode=require` Treated as `verify-full`

The `pg` driver v8 interprets `?sslmode=require` in the connection URL as `verify-full`, causing "self-signed certificate in certificate chain" errors with managed databases.

**Fix:** Strip `sslmode` from the URL and pass SSL config explicitly:
```ts
const url = new URL(rawUrl);
url.searchParams.delete('sslmode');
const adapter = new PrismaPg({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
```

---

## uuid v13 — ESM Only, Breaks Jest

uuid v13 dropped CJS support. Jest can't parse the ESM `export` statements.

**Fix:** Tell Jest to transform uuid through ts-jest:
```ts
transformIgnorePatterns: ['node_modules/.pnpm/(?!(uuid)@)']
```

The pnpm-specific pattern `(?!(uuid)@)` matches the `.pnpm/uuid@13.0.0/` directory structure.

---

## Jest Config — `.cts` Extension Incompatible with Jest 30

Jest 30 can't parse `.cts` config files without `ts-node` installed. Rename to `.ts` and update all references (project.json, tsconfig).

---

## Remote DB Test Timeouts

DigitalOcean managed PostgreSQL adds ~200ms latency per query. Default Jest 5s timeout is too short for integration tests that make 3-5 DB round trips.

**Fix:** Set `testTimeout: 30000` in jest config for API tests.

---

## E2E Global Setup — `globalThis` TypeScript Strict Mode

TypeScript strict mode rejects `globalThis.__TEARDOWN_MESSAGE__` because `typeof globalThis` has no index signature.

**Fix:** Cast: `(globalThis as Record<string, unknown>).__TEARDOWN_MESSAGE__`

---

## Nx E2E `dependsOn: api:serve` — Causes Hangs

Including `api:serve` in E2E project `dependsOn` causes Nx to launch/wait for the server as part of the dependency graph, which conflicts with manual server management.

**Fix:** Remove `api:serve` from dependsOn, start the server manually before running E2E.

---

## CI: Unit vs Integration Test Split

Unit tests (validation, route-policy, risk) use no DB and run fast. Integration tests need PostgreSQL.

**Pattern:** `--testPathIgnorePatterns="integration"` for CI, `--testPathPattern="integration"` for local DB tests.

---

## NestJS Error Responses — Status Codes

- `BadRequestException` → 400
- `NotFoundException` → 404
- Unhandled exceptions → 500

When writing E2E tests, check actual status codes from the API rather than assuming 500 for all errors. Use `toBeGreaterThanOrEqual(400)` for generic error assertions.
