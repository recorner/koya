# Guest Conversion Engine — KES → BTC

## Overview

Build the full guest conversion vertical slice: Landing page CTA → guest conversion page → quote → confirm → collect identity → collect BTC address → initiate M-Pesa STK push → wait for payment callback → execute mock conversion → show final status.

**Scope:** KES → BTC only. Guest mode. Web channel (WhatsApp-compatible architecture). Mock providers.

---

## Phase 1: Database & Schema

- [x] **1.1** Install Prisma + PostgreSQL driver (`prisma`, `@prisma/client`)
- [x] **1.2** Initialize Prisma in `apps/api/` (`npx prisma init`)
- [x] **1.3** Write `schema.prisma` with all required models:
  - `guest_profiles` — guest_ref, identity, phone, status, risk_level
  - `conversion_sessions` — channel, state machine, amounts, references
  - `conversion_quotes` — rate, spread, fee, TTL, status
  - `payment_instructions` — M-Pesa STK push details, provider refs
  - `payout_instructions` — BTC address, status
  - `conversion_state_events` — append-only audit trail
- [x] **1.4** Configure Prisma datasource (env var `DATABASE_URL` via `prisma.config.ts` for Prisma v7)
- [x] **1.5** Generate Prisma client (migration deferred — needs PostgreSQL running)

## Phase 2: Backend Domain Types & Route Policy

- [x] **2.1** Create shared conversion types in `libs/types/`:
  - `ConversionState` enum (15 states from engine.md)
  - `Channel` enum (WEB, WHATSAPP)
  - `PayinMethod`, `PayoutMethod` enums
  - `DocumentType` enum (NATIONAL_ID, PASSPORT, etc.)
  - Guest conversion DTOs (quote request, session, identity, payout)
- [x] **2.2** Create route policy module (`apps/api/src/conversion/route-policy.ts`):
  - Define supported routes (KES→BTC only for now)
  - Payin/payout method per route
  - Fee structure, spread config
  - State transition guard (valid transitions map)

## Phase 3: NestJS Modules & Services

- [x] **3.1** Create `PrismaModule` + `PrismaService` (shared DB access)
- [x] **3.2** Create `ConversionModule` with:
  - `ConversionController` — 6 endpoints:
    - `POST /api/v1/guest-conversion/quote`
    - `POST /api/v1/guest-conversion/session`
    - `POST /api/v1/guest-conversion/:sessionId/identity`
    - `POST /api/v1/guest-conversion/:sessionId/payout-details`
    - `POST /api/v1/guest-conversion/:sessionId/initiate-payment`
    - `GET  /api/v1/guest-conversion/:sessionId/status`
  - `ConversionService` — orchestration logic
  - `QuoteService` — quote generation, expiry validation
  - `SessionService` — state machine, transition guard
- [x] **3.3** Create `KycModule` with:
  - `GuestProfileService` — create/find guest profiles, dedup by identity
  - `ComplianceService` — mock IPRS verification, mock AML screening
  - `GuestLimitService` — daily/monthly limit enforcement
- [x] **3.4** Create `PaymentsModule` with:
  - `PaymentsController` — `POST /api/v1/payments/mpesa/callback`
  - `MpesaService` — STK push orchestration
  - `MpesaAdapter` interface + mock implementation
- [x] **3.5** Create `RiskModule` with:
  - `RiskService` — velocity checks, duplicate detection, limit enforcement
  - State transition validation

## Phase 4: Provider Adapters (Mocks)

- [x] **4.1** `MockRateProvider` — returns hardcoded KES→BTC rate with spread
- [x] **4.2** `MockIprsVerifier` — simulates Kenya IPRS identity check
- [x] **4.3** `MockAmlScreener` — simulates AML/sanctions screening
- [x] **4.4** `MockMpesaAdapter` — simulates STK push + callback generation
- [x] **4.5** `MockBtcDeliveryProvider` — simulates BTC send to address
- [x] **4.6** `MockSwapProvider` — simulates swap execution with 0-0.3% slippage

## Phase 5: Validation & Utilities

- [x] **5.1** KES amount validation (min/max, integer for minor units)
- [x] **5.2** Kenya phone number normalization to E.164
- [x] **5.3** Document number normalization
- [x] **5.4** BTC address validation (P2PKH, P2SH, Bech32, Taproot)
- [x] **5.5** Guest ref generation (12-digit numeric)
- [x] **5.6** Quote expiry enforcement (30s TTL)
- [x] **5.7** Idempotency key handling for payment callbacks

## Phase 6: Web Conversion Flow (Frontend)

- [x] **6.1** Create `/convert` route (`apps/web/app/(public)/convert/page.tsx`)
- [x] **6.2** Build multi-step conversion wizard component:
  - Step 1: Amount entry (KES input, BTC output preview)
  - Step 2: Quote review with 30-second countdown timer
  - Step 3: Identity form (name, country, doc type, doc number, phone, email)
  - Step 4: BTC address input with validation
  - Step 5: Payment pending screen (M-Pesa STK push status)
  - Step 6: Processing → Success / Failure screen with references
- [x] **6.3** API client service (`apps/web/lib/api/conversion.ts`)
- [x] **6.4** Wire guest swap widget CTA → `/convert` route
- [x] **6.5** Wire hero section CTA → `/convert` route

## Phase 7: Integration & Testing

- [x] **7.1** Unit tests:
  - Phone normalization, BTC address validation, amount parsing — `validation.utils.spec.ts`
  - State transition guard — `risk.service.spec.ts`
  - Route policy, limits, TTL — `route-policy.spec.ts`
- [x] **7.2** Integration tests (12 tests — `conversion-flow.integration.spec.ts`):
  - Full backend flow via NestJS TestingModule with real PostgreSQL
  - Quote creation, session management, identity submission
  - Payout details, identity dedup, status checks
  - Invalid state transition rejection
- [x] **7.3** E2E tests (17 tests — `api.spec.ts` + `conversion.spec.ts`):
  - HTTP-level tests via axios against running server
  - Full end-to-end flow (quote → session → identity → payout → payment → status)
  - Error handling (missing fields, invalid data, wrong state)

## Phase 8: Configuration & Documentation

- [x] **8.1** Add required env vars to `.env.example`
- [x] **8.2** Update `docs/progress/step-05.md` with completion notes
- [x] **8.3** Provider integration points documented via interface abstractions

## Phase 9: UX Polish & Real-time Data

- [x] **9.1** Landing → convert amount pass-through (`?amount=X` URL param)
- [x] **9.2** Real-time processing step (animated 4-stage progress between payment and result)
- [x] **9.3** Live BTC preview in AmountStep (replace static "—" with `MOCK_RATES` preview)
- [x] **9.4** Phone validation returns 400 (not 500) — `InvalidPhoneError` + `BadRequestException`
- [x] **9.5** Remove auto-submit on amount page — user must click "Get Quote"
- [x] **9.6** Real-time rate updates every 2s — `useRealtimeRates` hook
  - `useLiveRate()` → AmountStep
  - `useRealtimeRates()` → GuestSwapWidget
  - `useRealtimeTickers()` → MarketRibbon

## Phase 10: Containerization & Deployment

- [x] **10.1** Multi-stage Dockerfile (`apps/api/Dockerfile`) — Node 22 Alpine, non-root user, Prisma migrations on startup
- [x] **10.2** `.dockerignore` — excludes frontend, tests, docs, IDE files
- [x] **10.3** ECS Fargate deployment guide (`docs/deployment/ecs-fargate.md`) — task definition, ALB, security groups, secrets, CI/CD
- [ ] **10.4** Create ECR repository + push first image
- [ ] **10.5** Provision ECS cluster, service, ALB
- [ ] **10.6** Configure Secrets Manager with `DATABASE_URL` and API keys
- [ ] **10.7** Deploy + verify health check (`GET /api/v1/health`)
- [ ] **10.8** Update `NEXT_PUBLIC_API_URL` on Vercel to point to ALB domain
- [ ] **10.9** GitHub Actions deploy-api.yml pipeline

## Phase 11: Directus CMS Integration

- [x] **11.1** Set up Directus Docker container (`directus-koyabank-cms` on port 8055)
- [x] **11.2** Create CMS collections schema (8 collections: global_settings, seo_defaults, navigation, footer_columns, footer_links, pages, page_sections, faq_items, legal_pages)
- [x] **11.3** Create schema setup + seed script (`scripts/directus-setup.py`)
- [x] **11.4** Set public read permissions on all CMS collections
- [x] **11.5** Install `@directus/sdk`, add Directus env vars to `.env`
- [x] **11.6** Build Directus client (`apps/web/lib/directus/client.ts`)
- [x] **11.7** Build CMS TypeScript types (`apps/web/lib/directus/types.ts`)
- [x] **11.8** Build CMS query utilities (`apps/web/lib/directus/queries.ts`)
- [x] **11.9** Build section renderer mapping (`apps/web/lib/directus/section-renderer.tsx`)
- [x] **11.10** Build CMS wrapper components (`cms-swap-section`, `cms-rich-text`, `cms-cta`)
- [x] **11.11** Refactor homepage to CMS-driven with hardcoded fallback
- [x] **11.12** Create dynamic catch-all page route (`/[...slug]`)
- [x] **11.13** Create legal pages route (`/legal/[slug]`)
- [x] **11.14** Add `images.remotePatterns` for Directus assets in `next.config.js`
- [x] **11.15** Seed homepage with 10 sections + nav + footer + settings
- [x] **11.16** Verify production build passes (`npx nx build web`)

## Phase 12: Redis Caching Layer

- [x] **12.1** Install `ioredis` dependency
- [x] **12.2** Create `docker-compose.yml` with Redis service (redis:7-alpine, AOF persistence, healthcheck)
- [x] **12.3** Add Redis environment variables (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_TLS`)
- [x] **12.4** Create `CacheModule` (@Global) with:
  - `cache.types.ts` — `CacheConfig`, `LockResult` interfaces
  - `cache.constants.ts` — `REDIS_CLIENT` DI token, `CacheNamespace` prefixes, `DefaultTTL` values, `buildKey()` helper
  - `redis.provider.ts` — ioredis factory provider with auto-reconnect, TLS, ConfigService injection
  - `cache.service.ts` — typed service: get/set/delete/exists, getJSON/setJSON, setIfNotExists/increment, acquireLock/releaseLock, ping
  - `cache.module.ts` — @Global module with graceful shutdown
- [x] **12.5** Register `CacheModule` in `AppModule`
- [x] **12.6** Add health check endpoints (`GET /health` includes cache status, `GET /health/cache` dedicated)
- [x] **12.7** Unit tests (30 tests — mocked Redis): all cache operations, error handling, key namespace helpers
- [x] **12.8** Integration tests (11 tests — real Redis): connectivity, TTL expiry, distributed locks, concurrent access
- [x] **12.9** Documentation: `docs/progress/step-08.md`

## Phase 12b: Bank-Grade Rates Provider (Step 09)

- [x] **12b.1** Core types (`rates.types.ts`) — `NormalizedRate`, `RateSnapshot`, `ProviderHealthState`, `DerivedRoute`, `RatesHealthResponse`
- [x] **12b.2** Constants & config (`rates.constants.ts`) — 6 direct pairs, 7 derived pairs, derivation routes, staleness thresholds, MAX_DIVERGENCE(2%), symbol maps, helpers
- [x] **12b.3** Provider interface (`provider.interface.ts`) — `RatesProvider` with `getTicker`, `getMany`, `getHealth`
- [x] **12b.4** Binance adapter (`binance.provider.ts`) — `/api/v3/ticker/bookTicker`, 3 pairs, 5s timeout
- [x] **12b.5** Kraken adapter (`kraken.provider.ts`) — `/0/public/Ticker`, 3 pairs, 5s timeout
- [x] **12b.6** FX provider (`fx.provider.ts`) — mock KES/USD with jitter, swappable to real API
- [x] **12b.7** Validator (`rates.validator.ts`) — `isValid`, `isStale`, `checkDivergence`, `isSnapshotStale`
- [x] **12b.8** Route builder (`rates.route-builder.ts`) — `getRoute`, `getRequiredDirectPairs`, `derive` with inversion
- [x] **12b.9** Aggregator (`rates.aggregator.ts`) — parallel fetch, validate, reject stale, divergence check, median consensus
- [x] **12b.10** Cache layer (`rates.cache.ts`) — spot/derived/lastGood/providerHealth via CacheService, 600s last-good TTL
- [x] **12b.11** Health check (`rates.health.ts`) — provider states, core pair freshness, cache status
- [x] **12b.12** Service (`rates.service.ts`) — `getRate`, `getAllRates`, `getHealthReport`, cache-through with last-good fallback
- [x] **12b.13** Controller (`rates.controller.ts`) — `GET /rates`, `GET /rates/health`, `GET /rates/:pair`
- [x] **12b.14** Module (`rates.module.ts`) — provider DI, useFactory for service with provider array
- [x] **12b.15** Wire into AppModule, AppService health, AppController `/health/rates`
- [x] **12b.16** Unit tests (5 files, ~60 tests) — constants, validator, route-builder, aggregator, service
- [x] **12b.17** Integration tests (8 tests with real Redis) — fetch+cache, derived rates, last-good fallback, health
- [x] **12b.18** TypeScript strict mode — zero errors
- [x] **12b.19** All 241 tests passing (16 suites)
- [x] **12b.20** Documentation: `docs/progress/step-09.md`

## Phase 12c: Wire Live Rates into Conversion Flow

- [x] **12c.1** Make Binance/Kraken provider URLs env-configurable (`BINANCE_API_URL`, `KRAKEN_API_URL`) via ConfigService
- [x] **12c.2** Create `LiveRateProvider` adapter bridging `RatesService` → legacy `RateProvider` interface
- [x] **12c.3** Replace `MockRateProvider` with `LiveRateProvider` in `ConversionModule` (import `RatesModule`)
- [x] **12c.4** Fix WhatsApp integration test: add `CacheModule` import (transitive dependency via RatesModule)
- [x] **12c.5** Silence expected test log noise: `setLogger(no-op)` on TestingModule, `Logger.overrideLogger(false)` for plain tests
- [x] **12c.6** Update env files: `docker/api.env.example` and `docker/api.env` with `BINANCE_API_URL`, `KRAKEN_API_URL`
- [x] **12c.7** All 241 tests passing, zero `[Nest]` log noise in test output

## Phase 13: Production Readiness — Daraja + DFNS (Step 13)

- [x] **13.1** Replace `MockRateProvider` with real FX API (e.g. CoinGecko, Binance) — **Done via Step 09**: Binance + Kraken live adapters, FX mock swappable
- [x] **13.2** Replace `MockMpesaAdapter` with Safaricom Daraja API — **Done via Step 13**: `DarajaMpesaAdapter` with MPESA_DRIVER factory selection (mock/daraja)
- [ ] **13.3** Replace `MockIprsVerifier` with Kenya IPRS API
- [ ] **13.4** Replace `MockAmlScreener` with Chainalysis / ComplyAdvantage
- [x] **13.5** Replace `MockBtcDeliveryProvider` with `BriaClientService` (via `@koya/bria-adapter` — Step 11 ✅)
- [x] **13.5b** Add DFNS as BTC delivery driver — **Done via Step 13**: `DfnsBtcDeliveryProvider` with BTC_DELIVERY_DRIVER factory selection (mock/bria/dfns)
- [ ] **13.6** Replace `MockSwapProvider` with exchange API (e.g. Binance OTC)
- [x] **13.7** Webhook dedup service (`processed_webhooks` table, INSERT ON CONFLICT) — **Done via Step 13**
- [x] **13.8** Daraja audit trail (`daraja_requests` table) — **Done via Step 13**
- [x] **13.9** DFNS audit trail + HMAC webhook verification (`dfns_requests` table) — **Done via Step 13**
- [x] **13.10** Two-layer idempotency for M-Pesa callbacks — **Done via Step 13**
- [x] **13.11** Event-driven delivery lifecycle (delivery.confirmed/delivery.failed) — **Done via Step 13**
- [x] **13.12** Unit tests (26 new, 232 total passing) — **Done via Step 13**
- [x] **13.13** Documentation: `docs/progress/step-13.md` — **Done via Step 13**
- [ ] **13.14** WebSocket/SSE for real-time status updates (replace polling)
- [ ] **13.15** Rate limiting on guest endpoints
- [ ] **13.16** WhatsApp channel support
- [ ] **13.17** Admin dashboard for conversion monitoring

## Phase 12d: Bria NestJS Adapter (Step 11)

- [x] **12d.1** Install gRPC deps (`@grpc/grpc-js`, `@grpc/proto-loader`)
- [x] **12d.2** Scaffold `libs/bria-adapter` Nx library (package.json, project.json, tsconfigs, .swcrc, eslint)
- [x] **12d.3** Copy proto files (bria.proto, admin/api.proto, vendored struct.proto)
- [x] **12d.4** Create constants, types, error mapping (`bria.constants.ts`, `bria.types.ts`, `bria.errors.ts`)
- [x] **12d.5** Build `BriaClientService` — 12 public methods, retry logic, RxJS streaming
- [x] **12d.6** Build `BriaAdminService` — bootstrap, createAccount, listAccounts
- [x] **12d.7** Create `BriaModule` + barrel exports
- [x] **12d.8** Unit tests — 23/23 passing (mocked gRPC client)
- [x] **12d.9** E2e smoke test (port-check skip when Bria not running)
- [x] **12d.10** CI integration (`pnpm nx test bria-adapter` in validate job)
- [x] **12d.11** Lint clean, build passes (SWC), path alias registered
- [x] **12d.12** Documentation: `docs/progress/step-11.md`

## Phase 13: Web + WhatsApp Order Sync

- [ ] **13.1** Introduce a shared conversion session expiry window
  - Add `CONVERSION_SESSION_TTL_MINUTES` config (default `20`)
  - Start expiry when a quote is confirmed into an order/session
  - Persist `conversion_sessions.expires_at` on creation
  - Enforce expiry in web and WhatsApp paths (`submitIdentity`, `submitPayoutDetails`, `initiatePayment`, `confirmReference`, `getStatus`, payment callback handling)
  - Treat any order past the 20-minute window as definitively `EXPIRED` (no grace continuation)
  - Transition expired orders to `EXPIRED` with an audit event

- [ ] **13.2** Unify reference tracking between quote, web, and WhatsApp
  - Generate a stable customer-facing `referenceCode` at quote creation
  - Persist/carry the same reference code into the eventual conversion session
  - Show the reference code in the web quote review, WhatsApp quote message, and all later support/status surfaces
  - Ensure support can search or track from this reference without requiring chat context

- [ ] **13.3** Turn the existing web conversion detail/progress view into the universal order view
  - Reuse the current `/convert` progress/result experience instead of inventing a separate bespoke tracker surface
  - Make the final processing/detail view loadable from an existing order reference/session, even in a fresh browser session
  - Add API lookup endpoint(s) to fetch status by `referenceCode`
  - Ensure orders created from either web or WhatsApp resolve into the same web detail/progress experience
  - Include expiry, current state, payout/payment progress, and support-safe identifiers

- [ ] **13.4** Link WhatsApp outcomes back to the web tracker
  - Add a post-completion WhatsApp action to open the shared web order-detail view
  - Add the same link to active status messages where helpful
  - Support both direct URL fallback and richer WhatsApp button/template delivery where channel capabilities allow

- [ ] **13.5** Extend CMS for WhatsApp promotional preview links
  - Add Directus-managed preview/link entities with URL, title, copy, image/media, button label, and active/sort controls
  - Let WhatsApp templates reference CMS-managed preview content instead of hardcoding URLs in code
  - Update Twilio template generation to support CTA/media content types in addition to quick replies
  - Preserve a safe plain-text fallback when richer message types are unavailable

- [ ] **13.6** Keep web and WhatsApp copy/state models aligned
  - Centralize shared status wording and reference placement rules
  - Make expiry and tracking behavior channel-agnostic in backend services
  - Ensure WhatsApp never exposes less order visibility than web for the same session

- [ ] **13.7** Verification
  - Unit tests for session expiry enforcement and reference propagation
  - Integration tests covering expiry before payment, status-by-reference lookup, and WhatsApp tracking link delivery
  - Manual verification on web + WhatsApp against the live CMS-backed message config

---

## Phase 14: DFNS SDK + Bria PSBT Signing Engine

**Goal:** Implement `libs/dfns-sdk` TypeScript library and wire Bria-initiated PSBT signing through DFNS. Bria builds PSBTs → Koya stores metadata → DFNS signs → Koya submits signed PSBT back to Bria for broadcast. mTLS required in staging/prod, API-key fallback for sandbox.

- [x] **14.1** Create `libs/dfns-sdk` Nx library with DFNSClient class (mTLS + API-key auth, requestSignPsbt, getRequestStatus, webhook verification)
- [x] **14.2** Implement retry/backoff helper (exponential backoff + jitter, DfnsTransientError/DfnsPermanentError)
- [x] **14.3** Implement HMAC-SHA256 signature verification module
- [x] **14.4** Add `getBatch(id)` method to BriaClientService (returns unsigned PSBT)
- [x] **14.5** Add `PayoutPsbt` model to Prisma schema + migration
- [x] **14.6** Wire PSBT signing flow: BriaEventConsumer `payout_committed` → getBatch → DFNS sign → submitSignedPsbt
- [x] **14.7** Update DfnsBtcDeliveryProvider to use Bria + DFNS SDK
- [x] **14.8** Update DfnsService to use DFNS SDK (DfnsController unchanged — delegates correctly)
- [x] **14.9** Unit tests for libs/dfns-sdk (client, retry, signature) — 29 tests
- [x] **14.10** Unit tests for API changes (PSBT flow, delivery provider, controller) — 239 tests pass
- [x] **14.11** Run full test suite, lint, typecheck — all clean
- [x] **14.12** Write docs/progress/step-14.md

---

## Architecture Decisions

### State Machine
All conversion session state transitions go through a centralized guard. Invalid transitions are rejected with clear error messages. Every transition creates an append-only `conversion_state_events` record.

### WhatsApp Compatibility
The backend is channel-agnostic. `ConversionService` accepts a `channel` parameter (WEB or WHATSAPP). The same service methods drive both channels — only the transport layer differs. No web-specific logic in the core workflow.

### Provider Abstraction
All external integrations use interfaces:
- `RateProvider` → `MockRateProvider` (later: real FX API)
- `IdentityVerifier` → `MockIprsVerifier` (later: IPRS API)
- `AmlScreener` → `MockAmlScreener` (later: Chainalysis / ComplyAdvantage)
- `MpesaAdapter` → `MockMpesaAdapter` (later: Safaricom Daraja API)
- `BtcDeliveryProvider` → `MockBtcDeliveryProvider` (later: custody API)

### Financial Precision
All monetary amounts stored as `BigInt` in minor units (cents for KES, satoshis for BTC). No floating point arithmetic. Prisma `Decimal` type for rates.

### Idempotency
Payment callbacks use the M-Pesa `CheckoutRequestID` as idempotency key. Duplicate callbacks are safely ignored.

---

## Dependency Installation Required

```
pnpm add prisma @prisma/client          # Database ORM
pnpm add class-validator class-transformer  # DTO validation (NestJS)
pnpm add @nestjs/config                  # Environment config
pnpm add uuid                            # Idempotency keys
```

---

## File Structure (New Files)

```
apps/api/
├── prisma/
│   └── schema.prisma
└── src/
    ├── prisma/
    │   ├── prisma.module.ts
    │   └── prisma.service.ts
    ├── conversion/
    │   ├── conversion.module.ts
    │   ├── conversion.controller.ts
    │   ├── conversion.service.ts
    │   ├── quote.service.ts
    │   ├── session.service.ts
    │   ├── route-policy.ts
    │   └── dto/
    │       ├── quote-request.dto.ts
    │       ├── create-session.dto.ts
    │       ├── submit-identity.dto.ts
    │       └── submit-payout.dto.ts
    ├── kyc/
    │   ├── kyc.module.ts
    │   ├── guest-profile.service.ts
    │   ├── compliance.service.ts
    │   └── guest-limit.service.ts
    ├── payments/
    │   ├── payments.module.ts
    │   ├── payments.controller.ts
    │   ├── mpesa.service.ts
    │   └── adapters/
    │       ├── mpesa.adapter.ts (interface)
    │       └── mock-mpesa.adapter.ts
    ├── risk/
    │   ├── risk.module.ts
    │   └── risk.service.ts
    └── providers/
        ├── rate-provider.interface.ts
        ├── mock-rate.provider.ts
        ├── identity-verifier.interface.ts
        ├── mock-iprs.verifier.ts
        ├── aml-screener.interface.ts
        ├── mock-aml.screener.ts
        ├── btc-delivery.interface.ts
        └── mock-btc-delivery.provider.ts

apps/web/
├── app/
│   └── (public)/
│       └── convert/
│           └── page.tsx
├── components/
│   └── conversion/
│       ├── conversion-wizard.tsx
│       ├── amount-step.tsx
│       ├── quote-step.tsx
│       ├── identity-step.tsx
│       ├── payout-step.tsx
│       ├── payment-pending-step.tsx
│       └── result-step.tsx
└── lib/
    └── api/
        └── conversion.ts

libs/types/src/lib/
    └── conversion.ts          # Shared conversion domain types
```

---

## Execution Order

1. Install dependencies (Prisma, class-validator, @nestjs/config)
2. Phase 1: Schema → migrate → generate client
3. Phase 2: Domain types in shared lib
4. Phase 3: NestJS modules (Prisma → Providers → KYC → Risk → Payments → Conversion)
5. Phase 4: Mock adapters
6. Phase 5: Validation utilities
7. Phase 6: Frontend conversion flow
8. Phase 7: Tests
9. Phase 8: Config & docs

---

## Phase 9: WhatsApp Guest Conversion v1

- [x] **9.1** Add WhatsApp Prisma models (WhatsAppConversation, WhatsAppMessageEvent, enums) + migrate
- [x] **9.2** Install dependencies (twilio@5.13, @nestjs/event-emitter@3.0)
- [x] **9.3** Add Twilio/WhatsApp env vars to `.env`
- [x] **9.4** Create Twilio adapter interface + real/mock implementations
- [x] **9.5** Create WhatsApp core services (parser, template, idempotency, session, flow handler)
- [x] **9.6** Create WhatsApp service (orchestrator) + controller (webhook endpoint)
- [x] **9.7** Create notification listener (conversion.completed → WhatsApp message)
- [x] **9.8** Wire WhatsAppModule into AppModule with EventEmitterModule.forRoot()
- [x] **9.9** Add EventEmitter bridge: PaymentsController → payment.confirmed → ConversionService → conversion.completed
- [x] **9.10** Export ConversionService from ConversionModule
- [x] **9.11** Unit tests (parser, template, flow handler) — 45+ tests
- [x] **9.12** Integration tests (full WhatsApp flow, idempotency, cancel, help, status) — 8 tests
- [x] **9.13** Documentation (`docs/progress/step-07.md`)

**Result:** 105 tests, 8 suites, zero regressions. TypeScript zero errors.

## Phase 10: Order Expiry, Reference Tracking & CMS Preview Links

- [x] **10.1** Set 20-minute `expiresAt` TTL on session creation in `SessionService`
- [x] **10.2** Add `ensureNotExpired()` guard in `ConversionService` with `POST_PAYMENT_STATES` exception set
- [x] **10.3** Wire expiry checks into `submitIdentity`, `submitPayoutDetails`, `initiatePayment`, `confirmByReference`
- [x] **10.4** Add `EXPIRED` to valid state transitions for `IDENTITY_PENDING`, `COMPLIANCE_PENDING`, `PAYOUT_DETAILS_PENDING`
- [x] **10.5** Add `expiresAt` to `formatStatus()` response
- [x] **10.6** Add `getStatusByReference(referenceCode)` method + controller endpoint `GET by-reference/:ref/status`
- [x] **10.7** Add reference code to WhatsApp templates: `askFullName`, `confirmPayment`, `paymentInitiated`
- [x] **10.8** Add tracking URL to `paymentSuccess` template, `orderExpired` template
- [x] **10.9** Update flow handler to pass reference codes and handle order expiry errors
- [x] **10.10** Create `TrackingView` component (polling, 6-stage progress, order details)
- [x] **10.11** Wire `/convert?ref=KYA-XXXX` to render `TrackingView` in conversion wizard
- [x] **10.12** Dynamic `generateMetadata()` on convert page for OG tags when `?ref=` present
- [x] **10.13** Add `WhatsAppPreviewLink` CMS type, query function, Directus collection + seed data
- [x] **10.14** Integration tests: order expiry (3 tests), reference lookup (2 tests), expiresAt in status (1 test)
- [x] **10.15** Fix flow handler unit test mocks for new referenceCode usage

**Result:** 119 tests, 8 suites, zero regressions. API + Web builds pass.

---

### Phase 12e — Wire Bria as BTC_DELIVERY_PROVIDER

Wire the `@koya/bria-adapter` library into the conversion engine as a real BTC delivery driver, selectable via `BTC_DELIVERY_DRIVER` env var.

- [x] **12e.1** Add `externalId` (unique) and `providerPayoutId` to `PayoutInstruction` Prisma model + migration
- [x] **12e.2** Create `BriaBtcDeliveryProvider` — implements `BtcDeliveryProvider`, calls `briaClient.submitPayout()` with idempotent `externalId`
- [x] **12e.3** Add `useFactory` in `ConversionModule` for `BTC_DELIVERY_PROVIDER` — selects mock (default) or bria via `BTC_DELIVERY_DRIVER` env var
- [x] **12e.4** Two-phase delivery in `ConversionService` — mock path: instant COMPLETED; bria path: persist IDs, stay DELIVERY_PENDING
- [x] **12e.5** Create `BriaEventConsumerService` — subscribes to Bria event stream, handles `payout_broadcast` (txHash), `payout_settled` (COMPLETED), `payout_cancelled` (FAILED)
- [x] **12e.6** Create `BriaSetupService` — idempotent admin bootstrap, account/profile/wallet provisioning
- [x] **12e.7** Create `BriaSetupController` — dev-only `POST /api/v1/admin/bria/setup` endpoint
- [x] **12e.8** Unit tests: BriaBtcDeliveryProvider (6 tests) + BriaEventConsumerService (7 tests)
- [x] **12e.9** Fix pre-existing `libs/types` build error (`rootDir` in tsconfig.lib.json)

**Result:** 254 tests, 18 suites, zero regressions. API + types + bria-adapter builds pass. Lint clean.

---

## Phase 15: Engine — Cursor Persistence, Ops, Retention, CI

Redis cursor persistence, reconciliation job, PSBT retention, DFNS health check, nightly CI, and ops documentation.

- [x] **15.1** Redis cursor store — `RedisCursorStore` service using existing ioredis `REDIS_CLIENT`
- [x] **15.2** Wire cursor store into `BriaEventConsumerService` — load on init, save after each event
- [x] **15.3** PSBT retention cron service — archive `payout_psbts` older than 90 days
- [x] **15.4** Reconciliation cron service — daily Koya ↔ Bria ledger comparison
- [x] **15.5** Create `OpsModule` — wires retention + reconciliation into `AppModule`
- [x] **15.6** DFNS health check endpoint — `GET /internal/health/dfns` with TLS handshake validation
- [x] **15.7** Nightly CI workflow — GitHub Actions skeleton for DFNS integration tests
- [x] **15.8** mTLS ops docs + runbook — `docs/deployment/dfns-mtls.md`
- [x] **15.9** Unit tests — cursor store, retention, reconciliation, health check
- [x] **15.10** Verify — all tests pass, lint clean, types clean

**Result:** 301 tests, 27 suites, zero regressions. All libs pass. Lint clean.

---

## Phase 16: Engine — S3 Archival, CloudWatch, Circuit Breaker, Ops Tooling

Full production ops: S3 PSBT archival, CloudWatch metrics + SNS alarms, circuit breaker for signing, DFNS mock/integration scripts, self-hosted runner provisioning, mTLS rotation automation, full runbook expansion.

- [x] **16.1** Install AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/client-cloudwatch`)
- [x] **16.2** S3 archival in `PsbtRetentionService` — upload to S3 w/ KMS before marking `[archived]`
- [x] **16.3** Unit tests for S3 archival (mock S3 client)
- [x] **16.4** Terraform for S3 bucket + KMS key (`terraform/aws/s3_psbt_archive.tf`)
- [x] **16.5** PSBT retention restore playbook (`docs/deployment/psbt-retention.md`)
- [x] **16.6** CloudWatch `putMetricData` in `ReconciliationService`
- [x] **16.7** Reconciliation unit test update for CloudWatch metric
- [x] **16.8** Terraform for CloudWatch alarm + SNS (`terraform/aws/alerts_reconciliation.tf`)
- [x] **16.9** Reconciliation runbook (`docs/deployment/reconciliation.md`)
- [x] **16.10** Self-hosted runner CloudFormation + setup script
- [x] **16.11** Update nightly GH Actions workflow
- [x] **16.12** Nightly runner docs (`docs/deployment/nightly-runner.md`)
- [x] **16.13** mTLS rotation script (`scripts/rotate-dfns-mtls.sh`)
- [x] **16.14** ECS secret update script (`scripts/update-ecs-task-secret.sh`)
- [x] **16.15** Cert expiry check script (`scripts/check-cert-expiry.sh`)
- [x] **16.16** Circuit breaker in `PsbtSigningService` (Redis-backed)
- [x] **16.17** Sign-latency CloudWatch metric + alarm
- [x] **16.18** Circuit breaker unit tests
- [x] **16.19** DFNS mock server (`scripts/dfns-mock/server.js`)
- [x] **16.20** Integration run scripts (`scripts/run-dfns-mock.sh`, `scripts/run-integration.sh`)
- [x] **16.21** Full runbook expansion (`docs/deployment/dfns-mtls.md`)
- [x] **16.22** Verify — all tests pass, lint clean, types clean
- [x] **16.23** Write `docs/progress/step-16.md`

**Result:** 314 tests, 28 suites, zero regressions. All libs pass. Lint clean. Types clean.
