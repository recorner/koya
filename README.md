# Koya — Borderless Finance

A hybrid financial infrastructure platform combining mobile money rails, stablecoin liquidity, traditional banking, and crypto custody into a single borderless financial operating system.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Nx 22.5 + pnpm 10.32 |
| Web | Next.js 16 (App Router) |
| API | NestJS 11 |
| Database | PostgreSQL + Prisma 7.5 |
| Language | TypeScript 5.9 (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| CMS | Directus (headless) |
| Messaging | Twilio (WhatsApp) |
| Payments | Safaricom M-Pesa Daraja |
| Fonts | Syne · DM Sans · JetBrains Mono |

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start web app (port 3000)
pnpm dev:web

# Start API server (port 3333)
pnpm dev:api

# Start both
pnpm dev
```

## Workspace Structure

```
koya/
├── apps/
│   ├── web/                # Next.js 16 frontend
│   │   ├── app/
│   │   │   ├── (public)/   # Landing, /convert, /legal
│   │   │   ├── (auth)/     # Login, signup
│   │   │   └── (dashboard)/# Authenticated app
│   │   ├── components/
│   │   │   ├── conversion/ # Conversion wizard, tracking view
│   │   │   ├── marketing/  # Landing page sections
│   │   │   └── ui/         # shadcn/ui components
│   │   └── lib/
│   │       ├── api/        # API client (conversion endpoints)
│   │       ├── directus/   # CMS queries & types
│   │       └── hooks/      # React hooks
│   ├── api/                # NestJS backend
│   │   ├── prisma/         # Schema, migrations, config
│   │   └── src/
│   │       ├── conversion/ # Conversion engine (quote → session → identity → payout → payment)
│   │       ├── whatsapp/   # WhatsApp conversational flow (Twilio)
│   │       ├── payments/   # M-Pesa STK push + callbacks
│   │       ├── kyc/        # Guest profiles, compliance, limits
│   │       ├── risk/       # State machine validation, duplicate detection
│   │       └── providers/  # Twilio adapter, rate/BTC/swap mocks
│   └── api-e2e/            # End-to-end API tests
├── libs/
│   ├── types/              # Shared TypeScript types & enums
│   ├── config/             # App constants (currencies, branding)
│   └── ui/                 # Design token exports
├── docs/
│   ├── progress/           # Step-by-step build log (steps 01–07)
│   └── deployment/         # ECS Fargate deployment guide
├── nginx/                  # Reverse proxy configs
├── scripts/                # Directus CMS setup, E2E helpers
└── tasks/                  # Todo tracking & lessons learned
```

## API Endpoints

Base URL: `https://api.koyabank.com/api/v1`

### Conversion (`/guest-conversion`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/quote` | Create KES→BTC conversion quote |
| POST | `/session` | Create conversion session from a quote |
| POST | `/:sessionId/identity` | Submit identity (name, document, phone) |
| POST | `/:sessionId/payout-details` | Submit BTC payout address |
| POST | `/:sessionId/initiate-payment` | Initiate M-Pesa STK push |
| POST | `/:sessionId/confirm-reference` | Confirm payment via M-Pesa receipt |
| GET | `/:sessionId/status` | Get session status by ID |
| GET | `/by-reference/:referenceCode/status` | Get session status by reference code |

### Payments (`/payments`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/mpesa/callback` | M-Pesa STK push callback (idempotent) |

### WhatsApp (`/whatsapp`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook` | Twilio inbound webhook (returns TwiML) |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |

## Conversion Flow

```
Guest lands on /convert
    → Create quote (KES amount → BTC rate + fees)
    → Confirm quote → Creates session (ref: KYA-XXXXXXXX)
    → Submit identity (name, ID, phone)
    → Submit BTC payout address
    → Initiate M-Pesa payment (STK push or manual reference)
    → Payment confirmed → Execute swap → Deliver BTC
    → Track via /convert?ref=KYA-XXXXXXXX
```

**20-minute order TTL**: Sessions expire 20 minutes after creation (pre-payment states only). Once payment is initiated, expiry is not enforced.

**15-state machine**: `INTENT_CAPTURED → QUOTE_PENDING → QUOTE_READY → QUOTE_CONFIRMED → IDENTITY_PENDING → COMPLIANCE_PENDING → PAYOUT_DETAILS_PENDING → PAYMENT_PENDING → PAYMENT_CONFIRMED → EXECUTION_PENDING → DELIVERY_PENDING → COMPLETED`

### WhatsApp Channel

Users can complete the same flow via WhatsApp. Send "hi" to the Twilio WhatsApp number to start. The conversation flow mirrors the web wizard:

```
"hi" → Welcome menu → "1" → Enter amount → Confirm quote
→ Full name → Document number → Email (optional)
→ BTC address → "PAY" → M-Pesa payment → Completion + tracking link
```

Global commands: `HELP`, `CANCEL`, `STATUS`, `START OVER`

## Database

PostgreSQL with Prisma ORM. Models:

| Model | Purpose |
|-------|---------|
| `GuestProfile` | Identity, phone, risk level |
| `ConversionSession` | Conversion state machine, amounts, expiry |
| `ConversionQuote` | FX rate, spread, fees, TTL |
| `PaymentInstruction` | M-Pesa STK push tracking |
| `PayoutInstruction` | BTC delivery tracking |
| `ConversionStateEvent` | Append-only state audit trail |
| `WhatsAppConversation` | Chat session state + metadata |
| `WhatsAppMessage` | Inbound/outbound message log |

```bash
# Run migrations
cd apps/api/prisma && npx prisma migrate deploy

# Generate Prisma client
pnpm prisma generate --schema=apps/api/prisma/schema.prisma
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:web` | Start Next.js dev server (port 3000) |
| `pnpm dev:api` | Start NestJS dev server (port 3333) |
| `pnpm dev` | Start both servers |
| `pnpm build` | Build all projects |
| `pnpm lint` | Lint all projects |
| `pnpm typecheck` | TypeScript type check |
| `pnpm format` | Format with Prettier |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:port/koya?sslmode=require"

# M-Pesa Daraja
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_CALLBACK_URL=https://api.koyabank.com/api/v1/payments/mpesa/callback
MPESA_PASSKEY=...
MPESA_SHORTCODE=174379

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# Directus CMS
DIRECTUS_URL=https://cms.koyabank.com
DIRECTUS_TOKEN=...

# Optional
WHATSAPP_WEB_BASE_URL=https://koyabank.com
WHATSAPP_SESSION_TTL_MINUTES=10
CORS_ORIGINS=https://yourdomain.com
```

## Docker

```bash
# Build API image (from workspace root)
docker build -f apps/api/Dockerfile -t koya-api .

# Run container
docker run -p 3333:3333 \
  -e DATABASE_URL="postgresql://..." \
  -e NODE_ENV=production \
  koya-api
```

The container runs migrations on startup, then starts the NestJS server on port 3333.

## Deployment

| Service | Platform | Domain |
|---------|----------|--------|
| Web (Next.js) | Vercel | koyabank.com |
| API (NestJS) | Docker / ECS Fargate | api.koyabank.com |
| Database | DigitalOcean Managed PostgreSQL | — |
| CMS | Directus (self-hosted) | cms.koyabank.com |

Nginx reverse proxy configs are in `nginx/` with SSL via Let's Encrypt.

## Testing

```bash
# Run all API tests
pnpm nx test api

# Run without coverage
pnpm nx test api --no-coverage

# Unit tests only (no DB needed)
pnpm nx test api --testPathIgnorePatterns="integration"

# Integration tests only (needs PostgreSQL)
pnpm nx test api --testPathPattern="integration"
```

**119 tests across 8 suites** — conversion flow, WhatsApp parsing/templates/flow handler, risk validation, route policy, phone validation.

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| Vault Black | `#070708` | Primary background |
| Gold | `#D4AF37` | Primary accent, CTAs |
| Electric Cyan | `#00E5FF` | Signal/notification |
| Emerald | `#10B981` | Success states |

Glass morphism: frosted glass cards with `backdrop-blur` on dark backgrounds.

## License

Private — All rights reserved.
