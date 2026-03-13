# Step 05 — Guest Conversion Engine (Vertical Slice)

**Status:** Complete  
**Date:** 2025-07-19

---

## Scope

Full vertical slice of the guest KES → BTC conversion flow as specified in `engine.md`. This is Koya's flagship feature — a zero-account, M-Pesa-funded Bitcoin purchase that completes in under 60 seconds.

**User journey:** Landing page CTA → `/convert` page → Enter KES amount → View quote (30s TTL) → Submit identity (name, ID, phone) → Enter BTC address → M-Pesa STK push → Wait for payment → Conversion complete → Show tx hash + reference.

---

## What Was Built

### Backend (NestJS API)

#### Database Schema (`apps/api/prisma/schema.prisma`)
- 6 models: `GuestProfile`, `ConversionSession`, `ConversionQuote`, `PaymentInstruction`, `PayoutInstruction`, `ConversionStateEvent`
- 8 enums: `ConversionState` (15 states), `Channel`, `GuestStatus`, `RiskLevel`, `QuoteStatus`, `PaymentInstructionStatus`, `PayoutInstructionStatus`, `DocumentType`
- Prisma v7 compatible with `prisma.config.ts` for datasource configuration

#### Provider System (Dependency Inversion)
- 5 provider interfaces: `RateProvider`, `IdentityVerifier`, `AmlScreener`, `MpesaAdapter`, `BtcDeliveryProvider`
- 5 mock implementations for development: `MockRateProvider`, `MockIprsVerifier`, `MockAmlScreener`, `MockMpesaAdapter`, `MockBtcDeliveryProvider`
- Token-based injection — swap mocks for real providers without touching business logic

#### Modules
| Module | Services | Controllers | Purpose |
|--------|----------|-------------|---------|
| `PrismaModule` | `PrismaService` | — | Global database access |
| `KycModule` | `GuestProfileService`, `ComplianceService`, `GuestLimitService` | — | Identity verification, AML screening, guest limits |
| `RiskModule` | `RiskService` | — | State transition validation, duplicate detection |
| `PaymentsModule` | `MpesaService` | `PaymentsController` | STK push initiation, M-Pesa callback processing |
| `ConversionModule` | `QuoteService`, `SessionService`, `ConversionService` | `ConversionController` | Main orchestrator — quotes, sessions, identity, payout, payment, status |

#### API Endpoints (under `/api/v1/guest-conversion/`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/quote` | Create a 30-second quote with live rate |
| POST | `/session` | Start a conversion session from a confirmed quote |
| POST | `/:sessionId/identity` | Submit identity documents for compliance |
| POST | `/:sessionId/payout` | Submit BTC payout address |
| POST | `/:sessionId/pay` | Initiate M-Pesa STK push |
| GET | `/:sessionId/status` | Poll session status (also triggers payment processing) |
| POST | `/payments/mpesa/callback` | M-Pesa payment callback webhook |

### Shared Types (`libs/types/`)
- `libs/types/src/lib/conversion.ts`: All conversion domain types shared between frontend and backend
- Enums, interfaces, and the `VALID_STATE_TRANSITIONS` map for state machine enforcement

### Frontend (Next.js)

#### Conversion Wizard (`apps/web/components/conversion/`)
6-step wizard with `AnimatePresence` transitions:
1. **AmountStep** — KES input with validation (100 – 100,000 KES), creates quote
2. **QuoteStep** — Displays rate, fees, BTC amount; 30-second countdown timer; creates session
3. **IdentityStep** — Full name, document type/number, phone, email form; submits identity
4. **PayoutStep** — BTC address input with client-side regex validation
5. **PaymentPendingStep** — Initiates STK push, polls status every 3 seconds, mock callback after 5s
6. **ResultStep** — Shows success/failure with reference code, guest ref, tx hash, copy buttons

#### Convert Page (`apps/web/app/(public)/convert/page.tsx`)
- Public route with ambient gold glow background
- Glassmorphism card containing the wizard
- Trust footer with security messaging

#### Landing Page Integration
- `HeroSection` CTA → Links to `/convert` ("Convert KES to BTC")
- `GuestSwapWidget` CTA → Links to `/convert` ("Convert Now — No Account Needed")

### API Client (`apps/web/lib/api/conversion.ts`)
- Typed client with 6 methods matching all API endpoints
- Uses `NEXT_PUBLIC_API_URL` environment variable

### Utilities (`apps/api/src/common/validation.utils.ts`)
- `normalizeKenyaPhone()` — Handles 07XX, +254, 254, 01XX → E.164
- `isValidBtcAddress()` — P2PKH, P2SH, Bech32, Taproot regex validation
- `normalizeDocumentNumber()` — Uppercase, strip spaces/dashes
- `generateGuestRef()` — 12-digit numeric reference
- `validateKesAmount()` — Min 100, max 100,000 KES (in minor units)
- `parseAmountToMinor()` / `formatMinorToDisplay()` — BigInt conversion

### Route Policy (`apps/api/src/conversion/route-policy.ts`)
- Single route enabled: KES → BTC (guest channel)
- Guest limits: 100,000 KES/day, 300,000 KES/month
- Quote TTL: 30 seconds

### Unit Tests
- `validation.utils.spec.ts` — Phone normalization, BTC address validation, amount parsing
- `risk.service.spec.ts` — State transition validation
- `route-policy.spec.ts` — Route lookup, limits, TTL

---

## Configuration

New environment variables added to `.env.example`:
- `DATABASE_URL` — PostgreSQL connection string
- `MPESA_*` — M-Pesa API credentials (mock values for development)
- `RATE_PROVIDER_API_KEY` — Rate provider API key
- `BTC_DELIVERY_API_KEY` — BTC delivery provider API key

---

## Design Decisions

1. **Mock-first development:** All external integrations (M-Pesa, IPRS, AML, BTC) use mock providers injected via NestJS DI tokens. Swap to real providers by changing the module bindings — zero business logic changes.

2. **State machine enforcement:** The 15-state `ConversionState` enum with `VALID_STATE_TRANSITIONS` map prevents illegal state transitions. Every transition is recorded in the append-only `ConversionStateEvent` table.

3. **BigInt for money:** All monetary amounts stored as `BigInt` (minor units — cents for KES, satoshis for BTC). Never floating point.

4. **Prisma v7 compatibility:** Used `prisma.config.ts` for datasource URL configuration per Prisma v7 requirements. Schema uses provider-only datasource block.

5. **Idempotent callbacks:** M-Pesa callback processing skips already-confirmed/failed payments to prevent double-processing.

6. **Guest identity dedup:** Composite unique index on `(countryCode, documentType, documentNumber)` prevents duplicate guest profiles.

---

## Verification

- ✅ Backend TypeScript compilation — zero errors
- ✅ Frontend Next.js build — all 7 pages prerendered successfully
- ✅ Prisma client generation — Prisma v7 with prisma.config.ts
- ✅ `/convert` page included in production build output

---

## Next Steps

- Connect PostgreSQL database and run `prisma migrate dev`
- Replace mock providers with real integrations (Safaricom M-Pesa API, IPRS, Chainalysis, Bitcoin node)
- Add E2E tests for the full conversion flow
- Implement WebSocket/SSE for real-time status updates (replace polling)
- Add rate limiting and abuse prevention on guest endpoints
- Build admin dashboard for conversion monitoring
