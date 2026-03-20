# Step 11 — Bria NestJS Adapter Library

**Status:** Complete  
**Date:** 2026-03-20  
**Depends On:** Step 10 — Bria Bitcoin Custody Integration

---

## Scope

Build `@koya/bria-adapter` — a NestJS library wrapping Bria's gRPC API with dynamic proto loading, typed interfaces, error mapping, retry logic, and RxJS streaming. This adapter enables the API app to interact with Bria for BTC custody operations: wallet management, address derivation, payout submission, UTXO tracking, and event streaming.

**Goal:** A fully tested, lint-clean, buildable NestJS library that any module in the API app can import to interact with Bria's gRPC services.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   API App (NestJS)               │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │            BriaModule (import)               │ │
│  │                                              │ │
│  │  ┌───────────────┐  ┌────────────────────┐  │ │
│  │  │BriaClientSvc  │  │ BriaAdminSvc       │  │ │
│  │  │ (port 2742)   │  │ (port 2743)        │  │ │
│  │  │               │  │                    │  │ │
│  │  │ createProfile │  │ bootstrap()        │  │ │
│  │  │ importXpub    │  │ createAccount()    │  │ │
│  │  │ createWallet  │  │ listAccounts()     │  │ │
│  │  │ newAddress    │  │                    │  │ │
│  │  │ submitPayout  │  │                    │  │ │
│  │  │ subscribeAll  │  │                    │  │ │
│  │  │ ...           │  │                    │  │ │
│  │  └───────┬───────┘  └─────────┬──────────┘  │ │
│  └──────────┼────────────────────┼──────────────┘ │
│             │                    │                │
└─────────────┼────────────────────┼────────────────┘
              │  gRPC (grpc-js)    │
    ┌─────────▼────┐    ┌─────────▼────┐
    │  Bria :2742  │    │  Bria :2743  │
    │  BriaService │    │ AdminService │
    └──────────────┘    └──────────────┘
```

### Key Design Decisions

1. **Dynamic proto loading** — Uses `@grpc/proto-loader` + `@grpc/grpc-js` at runtime. No code generation step. Proto files are bundled as build assets. This keeps the build simple and matches Bria's rapid proto evolution.

2. **Two services, two ports** — `BriaClientService` connects to port 2742 (BriaService: wallets, addresses, payouts, events) and `BriaAdminService` connects to port 2743 (AdminService: bootstrap, accounts). Separate API keys for each.

3. **Typed interfaces without codegen** — All Bria domain types (profiles, xpubs, wallets, addresses, payouts, batches, events) are manually typed in `bria.types.ts`. The discriminated union `BriaEventPayload` enables type-safe event handling.

4. **Error mapping** — `BriaClientError` maps gRPC status codes to domain error codes (`NOT_FOUND`, `ALREADY_EXISTS`, `PERMISSION_DENIED`, etc.) with an `isTransient` flag for retry decisions.

5. **Automatic retry** — `callWithRetry` implements exponential backoff for transient errors (`UNAVAILABLE`, `DEADLINE_EXCEEDED`). Configurable max retries and base delay. Non-transient errors fail immediately.

6. **RxJS streaming** — `subscribeAll()` returns an `Observable<BriaEvent>`. Server-side gRPC stream is wrapped with proper teardown (cancel on unsubscribe) and `subscriber.closed` guards to prevent post-unsubscription errors.

7. **NestJS lifecycle** — Both services implement `OnModuleInit` (connect/load protos) and `OnModuleDestroy` (close channels). ConfigModule provides all env-driven settings.

8. **Vendored struct.proto** — `google/protobuf/struct.proto` is vendored in `proto/google/protobuf/` to avoid runtime dependency on protobuf system includes. Required by `bria.proto`'s `Struct` field type.

---

## Files Created

| File | Purpose |
|------|---------|
| `libs/bria-adapter/package.json` | Library package: `@koya/bria-adapter`, deps on grpc-js, proto-loader, NestJS, rxjs |
| `libs/bria-adapter/project.json` | Nx project config: `@nx/js:swc` build, `@nx/jest:jest` test, proto asset copying |
| `libs/bria-adapter/tsconfig.json` | Base tsconfig extending root |
| `libs/bria-adapter/tsconfig.lib.json` | Build tsconfig, excludes test files |
| `libs/bria-adapter/tsconfig.spec.json` | Test tsconfig with jest types |
| `libs/bria-adapter/jest.config.ts` | Jest 30 config (CJS `module.exports`), ts-jest, uuid transform fix, e2e excluded |
| `libs/bria-adapter/eslint.config.mjs` | ESLint config with `ignoredDependencies` for dep-checks rule |
| `libs/bria-adapter/.swcrc` | SWC compiler config matching other libs (decorators, CJS output) |
| `libs/bria-adapter/proto/api/bria.proto` | Bria gRPC service definition (BriaService, ~30 RPCs) |
| `libs/bria-adapter/proto/admin/api.proto` | Bria Admin gRPC service definition (AdminService, 3 RPCs) |
| `libs/bria-adapter/proto/google/protobuf/struct.proto` | Vendored protobuf Struct definition |
| `libs/bria-adapter/src/bria.constants.ts` | DI tokens, env var names, defaults (ports, timeouts, retry config), proto paths |
| `libs/bria-adapter/src/bria.types.ts` | TypeScript interfaces for all Bria domain types + discriminated event union |
| `libs/bria-adapter/src/bria.errors.ts` | `BriaClientError` with gRPC→domain error mapping and `isTransient` flag |
| `libs/bria-adapter/src/bria-client.service.ts` | Core gRPC client: 12 public methods, retry logic, streaming, metadata auth |
| `libs/bria-adapter/src/bria-admin.service.ts` | Admin gRPC client: bootstrap, createAccount, listAccounts |
| `libs/bria-adapter/src/bria.module.ts` | NestJS module importing ConfigModule, providing/exporting both services |
| `libs/bria-adapter/src/index.ts` | Barrel exports: module, services, errors, constants, types |
| `libs/bria-adapter/src/__tests__/bria-client.service.spec.ts` | 23 unit tests covering all methods, error mapping, retry, streaming |
| `libs/bria-adapter/test/e2e/bria-adapter.e2e.spec.ts` | E2e smoke test (port-check skip, requires running Bria container) |
| `libs/bria-adapter/README.md` | Architecture docs, env vars, usage examples, proto refresh, security notes |

## Files Modified

| File | Change |
|------|--------|
| `tsconfig.base.json` | Added `@koya/bria-adapter` path alias |
| `apps/api/jest.config.ts` | Added `@koya/bria-adapter` moduleNameMapper for test resolution |
| `.github/workflows/ci.yml` | Added `pnpm nx test bria-adapter` step in validate job |
| `package.json` | Added `@grpc/grpc-js` and `@grpc/proto-loader` to root dependencies |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BRIA_API_HOST` | Bria API gRPC host | `localhost` |
| `BRIA_API_PORT` | Bria API gRPC port | `2742` |
| `BRIA_API_KEY` | API key for BriaService (per-account) | — |
| `BRIA_ADMIN_HOST` | Bria Admin gRPC host | `localhost` |
| `BRIA_ADMIN_PORT` | Bria Admin gRPC port | `2743` |
| `BRIA_ADMIN_API_KEY` | Admin API key (from bootstrap) | — |
| `BRIA_TIMEOUT_MS` | gRPC deadline per call | `10000` |
| `BRIA_MAX_RETRIES` | Max retry attempts for transient errors | `3` |
| `BRIA_RETRY_BASE_MS` | Base delay for exponential backoff | `500` |

---

## Verification Evidence

### Unit Tests (23/23 passing)

```
PASS  bria-adapter  libs/bria-adapter/src/__tests__/bria-client.service.spec.ts
  BriaClientService
    createProfile
      ✓ returns profile id on success
      ✓ passes spending policy when provided
      ✓ maps gRPC errors to BriaClientError
    createProfileApiKey
      ✓ returns API key
    importXpub
      ✓ returns xpub id
    createWallet
      ✓ returns wallet id
      ✓ passes keychain config
    getWalletBalance
      ✓ returns balance object
    newAddress
      ✓ returns address and external id
    submitPayout
      ✓ returns payout id
      ✓ passes external_id for idempotency
    estimatePayoutFee
      ✓ returns fee estimate
    getPayout
      ✓ returns payout info by id
      ✓ supports lookup by externalId
    cancelPayout
      ✓ succeeds with no return value
    submitSignedPsbt
      ✓ succeeds
    subscribeAll
      ✓ emits parsed events
      ✓ errors are mapped to BriaClientError
      ✓ completes when stream ends
    retry logic
      ✓ retries transient UNAVAILABLE errors
      ✓ does not retry non-transient errors
      ✓ gives up after max retries
    metadata
      ✓ attaches x-bria-api-key header to every call

Test Suites: 1 passed, 1 total
Tests:       23 passed, 23 total
```

### Lint

```
$ pnpm nx lint bria-adapter
✔  Successfully ran target lint for project bria-adapter
```

### Build

```
$ pnpm nx build bria-adapter
Compiling with SWC for bria-adapter...
✔  Successfully ran target build for project bria-adapter
```

---

## Public API

### BriaClientService (12 methods)

| Method | gRPC RPC | Returns |
|--------|----------|---------|
| `createProfile(input)` | `CreateProfile` | `{ id }` |
| `createProfileApiKey(input)` | `CreateProfileApiKey` | `{ key, id }` |
| `importXpub(input)` | `ImportXpub` | `{ id }` |
| `createWallet(input)` | `CreateWallet` | `{ id }` |
| `getWalletBalance(input)` | `GetWalletBalanceSummary` | `WalletBalance` |
| `newAddress(input)` | `NewAddress` | `{ address, externalId }` |
| `submitPayout(input)` | `SubmitPayout` | `{ id }` |
| `estimatePayoutFee(input)` | `EstimatePayoutFee` | `{ satoshis }` |
| `getPayout(input)` | `GetPayout` | `Payout` |
| `cancelPayout(input)` | `CancelPayout` | `void` |
| `submitSignedPsbt(input)` | `SubmitSignedPsbt` | `void` |
| `subscribeAll(input)` | `SubscribeAll` | `Observable<BriaEvent>` |

### BriaAdminService (3 methods)

| Method | gRPC RPC | Returns |
|--------|----------|---------|
| `bootstrap()` | `Bootstrap` | `{ key }` |
| `createAccount(name)` | `CreateAccount` | `{ key, accountId }` |
| `listAccounts()` | `ListAccounts` | `BriaAccount[]` |

---

## Lessons Learned

### Jest 30 + CJS package.json

Jest 30 cannot load `.ts` config files that use `export default` when the nearest `package.json` has `"type": "commonjs"`. Must use `module.exports =` syntax instead. This is a known ts-jest/Jest 30 interop issue.

### RxJS Observable Mock Streams

When testing Observable-wrapped gRPC streams, the mock `EventEmitter` must include a `cancel()` method matching what the teardown function calls. Without it, unsubscription triggers `UnsubscriptionError`. Solution: create a `createMockStream()` helper that adds `cancel: jest.fn()` to the EventEmitter.

### GrpcClient Type Without Index Signature

Extending `grpc.Client` with an index signature (`[method: string]: ...`) causes TS2411 because existing `grpc.Client` properties don't match the callable signature. Use `type GrpcClient = grpc.Client` instead and cast to `Record<string, ...>` at call sites.

### @nx/dependency-checks False Positives

The `@nx/dependency-checks` ESLint rule analyzes the SWC build output, which may not preserve all import metadata. For libraries with dynamic `require()` or gRPC proto loading, use `ignoredDependencies` in the ESLint config to suppress false positives.

### .swcrc Required for @nx/js:swc

The `@nx/js:swc` executor requires a `.swcrc` file in the library root. Without it, the build fails with `ENOENT`. Copy from an existing library that uses the same executor.

---

## Security Checklist

- [x] API keys read from environment — never hardcoded
- [x] gRPC metadata uses `x-bria-api-key` header per Bria spec
- [x] Admin key separate from per-account API keys
- [x] No secrets in proto files or test fixtures
- [x] Test mocks use placeholder values, not real credentials
- [x] E2e tests skip when Bria container unavailable (no CI failures)
- [x] Proto files vendored locally — no external proto fetch at runtime

---

## Next Steps

- [ ] Bootstrap Bria admin and create initial account/profile for Koya
- [ ] Import testnet4 xpub and create HD wallet
- [ ] Wire `BriaClientService` into guest conversion flow as `BTC_DELIVERY_PROVIDER`
- [ ] Replace `MockBtcDeliveryProvider` with real Bria delivery
- [ ] Add integration tests with running Bria container in CI
- [ ] Implement `SubscribeAll` event consumer for payout status tracking
