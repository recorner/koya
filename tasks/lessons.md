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

## EventEmitter DI — Update Test Modules When Adding EventEmitter2

When a service gains an `EventEmitter2` dependency, all test modules that provide that service must import `EventEmitterModule.forRoot()`. Otherwise tests fail with "Nest can't resolve dependencies of..." error.

---

## Prisma JSON Fields — Use `undefined` Not `null`

For optional Prisma JSON fields, use `undefined` (not `null`) when you want to omit the value. Prisma treats `null` as "set field to SQL NULL" which can conflict with `JsonValue` typing. Using `undefined` means "don't touch this field".

---

## TypeScript Strict — Regex Capture Groups Are Possibly Undefined

With strict mode, `match[1]` after a regex `.match()` call is `string | undefined`. Always guard with `match && match[1]` or use optional chaining before using capture group values.

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

## PostgreSQL 18 — uuid-ossp Inlining Bug Breaks Bria Migrations

DigitalOcean managed Postgres upgraded to PG 18.3. Bria's sqlx migrations use `uuid_nil()` from the `uuid-ossp` extension inside SQL functions (e.g., `mq_uuid_exists()`). PG 18 tries to inline these functions during index creation and fails to resolve `uuid_nil()` — even though the function exists and works when called directly.

**Error:** `function uuid_nil() does not exist` — `CONTEXT: SQL function "mq_uuid_exists" during inlining`

**Fix:** Use a local Postgres 16 container (`bria-pg` service in docker-compose) for Bria instead of the managed PG 18 instance. Bria requires PG ≤16 until upstream migrations are updated.

---

## Avoid `import { Request } from 'express'` in NestJS

Importing `Request` from `express` requires `@types/express` as a devDep. If not installed, the build breaks. For controllers that only need the raw body, define a minimal local interface:

```ts
interface MinimalRequest { body: unknown; }
```

This avoids pulling in the full `@types/express` package.

---

## Prisma `InputJsonValue` — Use Double Cast

`rawPayload: body as Record<string, unknown>` doesn't satisfy Prisma's `Prisma.InputJsonValue` type. Use a double cast:

```ts
import { Prisma } from '@prisma/client';
rawPayload: body as unknown as Prisma.InputJsonValue,
```

---

## Event-Driven Architecture to Avoid Circular Module Dependencies

When a webhook controller (e.g., DfnsController) needs to update ConversionService state, importing ConversionModule into DfnsModule creates a circular dep because ConversionModule already imports DfnsModule for the provider factory.

**Fix:** Use EventEmitter2 — the webhook controller emits events (`delivery.confirmed`, `delivery.failed`), and ConversionService listens with `@OnEvent()` decorators. No circular imports needed.

---

## NestJS Factory Providers — Multi-Driver Pattern

When adding a third driver option (e.g., `dfns` alongside `mock` and `bria`), update the `useFactory` switch/if-else to handle all cases. Default to `mock` for safety. Import the new module that provides the driver in the parent module's `imports` array.

**Rule:** Always check target Postgres version compatibility before using managed DB instances for third-party tools with their own migrations.

---

## Bria CLI — Actual Daemon Syntax

engine.md spec had `bria daemon --config /etc/bria/bria.yml ${BRIA_DATABASE_URL} prod` — this is wrong.

**Actual syntax:** `bria daemon [--config <file>] <db_con> <subcommand>`
- Subcommands: `run <signer_encryption_key>` (production) or `dev` (development)
- All args can be provided via env vars: `BRIA_CONFIG`, `PG_CON`, `SIGNER_ENCRYPTION_KEY`
- Docker CMD: `["bria", "daemon", "run"]` — env vars handle the rest

**Rule:** Always read the actual CLI source (`src/cli/mod.rs`) rather than trusting external specs for command syntax.

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

---

## useFactory for Driver-Selectable Providers

When a provider has multiple implementations (mock, bria, future dfns), use NestJS `useFactory` with `ConfigService` to select at startup:

```ts
{
  provide: 'BTC_DELIVERY_PROVIDER',
  useFactory: (config, mock, bria) =>
    config.get('BTC_DELIVERY_DRIVER', 'mock') === 'bria' ? bria : mock,
  inject: [ConfigService, MockBtcDeliveryProvider, BriaBtcDeliveryProvider],
}
```

All concrete providers must be in the module's `providers` array so DI can inject them into the factory. The env var controls which one is used at runtime — mock stays default.

---

## Two-Phase Delivery Requires Behavioral Branching

When swapping a synchronous mock (instant result) for an async real provider (result arrives later via events), the calling service must branch behavior:

- **Mock path:** `send()` returns txHash → immediately transition to COMPLETED
- **Async path:** `send()` returns provider ID → persist IDs, stay in PENDING → event consumer completes later

Don't try to make both paths look identical — the async nature fundamentally changes the state machine flow.

---

## Prisma Migrate Deploy Requires `--config` Flag (v7)

`prisma migrate deploy` in Prisma v7 doesn't auto-discover `prisma.config.ts` from the schema location. You must pass it explicitly:

```bash
npx prisma migrate deploy --config prisma/prisma.config.ts
```

Without `--config`, it falls back to looking for a `datasource.url` in the schema file (which v7 doesn't allow).

---

## Pre-Existing DB Columns Cause Migration Failures

If DB columns already exist (from a prior manual apply or debug session) but the migration wasn't recorded in `_prisma_migrations`, `prisma migrate deploy` will fail with "column already exists".

**Fix:** Mark the migration as already applied:
```bash
npx prisma migrate resolve --applied "20260320100000_migration_name" --config prisma/prisma.config.ts
```

Then verify with `prisma migrate status`. Don't drop and recreate — the data might matter.

---

## SWC Build — rootDir Must Be Set for Library Builds

When using `@nx/js:swc` executor for a library, TypeScript may complain about `TS6059: File is not under 'rootDir'` if rootDir isn't explicitly set in `tsconfig.lib.json`. This happens when the project has files outside the default rootDir inference.

**Fix:** Add `"rootDir": "./src"` to `compilerOptions` in the library's `tsconfig.lib.json`.

---

## UX Planning — Reuse the Canonical User View Before Designing a New One

When the user describes "tracking" or "view details", do not assume that means a brand-new route or bespoke screen. First inspect the existing product flow and prefer turning the current canonical detail/progress view into the universal entry point for all channels.

In this project specifically:
- The existing `/convert` progress/result experience should become the shared order-detail view.
- WhatsApp should deep-link into that same experience rather than spawning a parallel tracking UI.

---

## Jest 30 + CJS package.json — `export default` Breaks Config Loading

Jest 30 cannot load `.ts` config files that use `export default` when the nearest `package.json` has `"type": "commonjs"`. The ESM export syntax conflicts with the CJS module system.

**Fix:** Use `module.exports =` instead of `export default` in jest.config.ts files for libraries with `"type": "commonjs"`.

---

## RxJS Observable Mock Streams — Must Include cancel()

When testing RxJS Observable-wrapped gRPC server streams, the mock EventEmitter must include a `cancel()` method. The Observable teardown function calls `cancel()` on unsubscription. Without it, `UnsubscriptionError` is thrown.

**Fix:** Create a helper:
```ts
function createMockStream() {
  const stream = new EventEmitter() as EventEmitter & { cancel: jest.Mock };
  stream.cancel = jest.fn();
  return stream;
}
```

---

## @nx/js:swc — Requires .swcrc File

The `@nx/js:swc` executor fails with `ENOENT` if no `.swcrc` file exists in the library root. This file is not included in the Nx generator scaffolding.

**Fix:** Copy `.swcrc` from an existing library that uses the same executor (e.g., `libs/config/.swcrc`).

---

## GrpcClient Type — Don't Extend grpc.Client with Index Signature

Extending `grpc.Client` with `[method: string]: (...args: unknown[]) => unknown` causes TS2411 because existing `grpc.Client` properties (like `waitForReady`, `makeUnaryRequest`) have incompatible signatures.

**Fix:** Use `type GrpcClient = grpc.Client` and cast to `Record<string, (...args: unknown[]) => unknown>` at individual call sites.

---

## @nx/dependency-checks — SWC Build Output Causes False Positives

The `@nx/dependency-checks` ESLint rule analyzes the SWC build output to verify package.json deps. Dynamic imports, proto loading, and NestJS dependency injection may not be captured in the compiled output.

**Fix:** Use `ignoredDependencies` array in the ESLint config for known-used packages that the checker can't detect:
```js
'@nx/dependency-checks': ['error', {
  ignoredDependencies: ['@grpc/grpc-js', '@grpc/proto-loader', ...],
}]
```

---

## State Machine — EXPIRED Must Be Reachable From All Pre-Payment States

When adding expiry enforcement to a state machine, ensure that every state where expiry can be checked has `EXPIRED` in its valid transitions list. Otherwise the `transitionState()` call inside `ensureNotExpired()` throws "Invalid state transition" instead of the intended expiry error. In this project, `IDENTITY_PENDING`, `COMPLIANCE_PENDING`, and `PAYOUT_DETAILS_PENDING` all needed `EXPIRED` added to `VALID_STATE_TRANSITIONS`.

---

## Flow Handler Tests — Mock All Service Calls Added to a Method

When a flow handler method gains a new service call (e.g., `getStatus()` after `initiatePayment()`), every test exercising that code path needs the new mock. Missing mocks cause `TypeError: Cannot read properties of undefined` at runtime rather than a clear assertion failure.

---

## TypeScript Strict — Array Indexing Returns `T | undefined`

With `noUncheckedIndexedAccess` (part of strict), `arr[i]` returns `T | undefined` even inside a bounded `for` loop. Same for `Record<string, T>` lookups.

**Patterns that work:**
```ts
// Non-null assertion when bounds are guaranteed
for (let i = 0; i < arr.length; i++) {
  const val = arr[i]!; // safe — i is bounded
}

// Fallback for Record lookups
const confidence = CONFIDENCE_MAP[provider] ?? 0.5;

// Destructuring alternative for known-length results
const [base, quote] = pair.split('/');
// becomes:
const parts = pair.split('/');
const base = parts[0] ?? '';
const quote = parts[1] ?? '';
```

**Why this matters:** ~20 errors appeared in the rates module on first compile, all from array/record indexing. One pass with `!` assertions (bounded loops) and `?? fallback` (record lookups) fixed them all.

---

## NestJS Provider Array Pattern — useFactory for Multi-Provider Injection

When a service needs an array of providers (e.g., multiple rate adapters), use `useFactory` in the module to inject each provider individually and pass them as an array:

```ts
{
  provide: RatesService,
  useFactory: (binance, kraken, fx, ...deps) =>
    new RatesService([binance, kraken, fx], ...deps),
  inject: [BinanceProvider, KrakenProvider, FxProvider, ...DepTokens],
}
```

This avoids a custom multi-inject token and keeps each provider independently testable.

---

## NestJS Test Logger — `.setLogger(false)` Requires LoggerService in v11

`TestingModuleBuilder.setLogger(false)` doesn't accept `boolean` in NestJS 11. Use a no-op object:

```ts
Test.createTestingModule({ ... })
  .setLogger({ log() {}, error() {}, warn() {}, debug() {}, verbose() {}, fatal() {} })
  .compile();
```

For non-TestingModule tests (plain class instantiation), `Logger.overrideLogger(false)` still works but only affects Logger instances created AFTER the call. Use the `beforeAll` hook to set it before any test code runs.

---

## Replacing Mock Providers — Import the New Module's Dependencies

When swapping a mock provider (e.g., `MockRateProvider`) with a live adapter that depends on another module (e.g., `LiveRateProvider → RatesService → CacheModule`), ALL integration tests that transitively import the changed module MUST include the new dependency. In this project, `WhatsAppModule → ConversionModule → RatesModule → CacheModule`, so the WhatsApp integration test needed `CacheModule` added to its imports.
