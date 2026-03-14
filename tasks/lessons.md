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

---

## Phone Validation — Throw Proper HTTP Errors, Not Generic Errors

`normalizeKenyaPhone()` originally threw a generic `Error`, which NestJS turned into a 500. Client-facing validation errors must return 400.

**Fix:** Create a domain-specific error class (`InvalidPhoneError`), catch it in the service layer, and re-throw as `BadRequestException(400)`. Never let raw domain errors bubble up to the HTTP layer.

---

## Python `urllib` — Empty Dict is Falsy

`if data` evaluates to `False` for `{}` in Python. When building HTTP helpers, use `if data is not None` to distinguish "no body" from "empty body". With `urllib.request.Request`, passing `data=None` sends a GET instead of POST.

```python
# Wrong — empty dict {} becomes GET
body = json.dumps(data).encode() if data else None

# Correct — only None means no body
body = json.dumps(data).encode() if data is not None else None
```

---

## Prisma v7 — `url` Banned in `schema.prisma` Datasource

Prisma v7 no longer allows `url = env("DATABASE_URL")` in the schema's `datasource` block. The URL must come from `prisma.config.ts` (or `.js`) via `datasource: { url: process.env.DATABASE_URL }`.

**Impact on Docker:** Production containers don't have TypeScript runtime, so you can't use `prisma.config.ts`. Generate a plain `.js` config in the Dockerfile's runner stage:

```dockerfile
RUN printf 'const path = require("path");\nconst { defineConfig } = require("prisma/config");\nmodule.exports = defineConfig({\n  earlyAccess: true,\n  schema: path.join(__dirname, "schema.prisma"),\n  datasource: { url: process.env.DATABASE_URL }\n});\n' > prisma/prisma.config.js
```

---

## Prisma v7 — Config File Discovery is CWD-Relative

`prisma migrate deploy --schema=prisma/schema.prisma` does NOT look for `prisma.config.js` relative to the schema file. It looks in the current working directory.

**Fix:** `cd prisma && npx prisma migrate deploy` instead of running from the app root with `--schema=prisma/schema.prisma`.

---

## Webpack `generatePackageJson` Misses `tslib`

NxAppWebpackPlugin's `generatePackageJson: true` auto-detects runtime dependencies from imports, but misses `tslib` because it's injected by TypeScript's `importHelpers` compiler option (not an explicit import).

**Fix:** Add `tslib` manually in the Dockerfile's runner stage:

```dockerfile
RUN pnpm install --frozen-lockfile --prod
RUN pnpm add tslib
```

---

## Docker Build Context — Monorepo Needs Full Root

The API Dockerfile lives at `apps/api/Dockerfile` but the build context must be the workspace root (not `apps/api/`), because the Nx build needs access to `libs/`, `package.json`, `pnpm-lock.yaml`, etc.

```bash
# Correct — build from workspace root
docker build -f apps/api/Dockerfile -t koya-api .

# Wrong — missing monorepo context
docker build -t koya-api apps/api/
```

---

## Container Architecture — One Service Per Container

Never pack multiple services (API + frontend + workers) into one container. Each service gets its own image and ECS service for independent scaling and deployment. The API monolith is fine initially — split into microservices only when a specific scaling bottleneck emerges.
