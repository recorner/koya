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

## Phase 12: Production Readiness (Next)

- [ ] **12.1** Replace `MockRateProvider` with real FX API (e.g. CoinGecko, Binance)
- [ ] **12.2** Replace `MockMpesaAdapter` with Safaricom Daraja API
- [ ] **12.3** Replace `MockIprsVerifier` with Kenya IPRS API
- [ ] **12.4** Replace `MockAmlScreener` with Chainalysis / ComplyAdvantage
- [ ] **12.5** Replace `MockBtcDeliveryProvider` with custody API (e.g. Fireblocks)
- [ ] **12.6** Replace `MockSwapProvider` with exchange API (e.g. Binance OTC)
- [ ] **12.7** WebSocket/SSE for real-time status updates (replace polling)
- [ ] **12.8** Rate limiting on guest endpoints
- [ ] **12.9** WhatsApp channel support
- [ ] **12.10** Admin dashboard for conversion monitoring

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
