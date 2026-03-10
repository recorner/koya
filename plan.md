# KOYA BANK — Comprehensive MVP North-Star Plan

## TL;DR

Koya Bank is a borderless financial operating system targeting African global workers and crypto-natives. The MVP delivers a full-stack fintech platform: multi-currency wallets (KES/USD/BTC/USDC/USDT), universal asset conversion, M-Pesa rails, stablecoin USD accounts, US stock trading, card issuance, and a transactional WhatsApp bot — all wrapped in a premium glassmorphism UI. Built solo on NestJS + Next.js + PostgreSQL, deployed on AWS, with a 3-month aggressive timeline requiring strict phased milestones.

**Competitive edge over Xapo:** Xapo is Bitcoin-centric, members-only, Gibraltar-regulated, targets HNW Bitcoin holders. Koya is Africa-first, multi-asset, accessibility-focused (WhatsApp bot, guest swaps, M-Pesa integration), and serves the underbanked global worker — not just Bitcoin maximalists.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│  Next.js Web App │ React Native Mobile │ WhatsApp Bot (Twilio)      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                      API GATEWAY (Kong / AWS API Gateway)           │
│              Rate Limiting │ Auth │ Request Routing                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                    CORE SERVICE MESH (NestJS Monorepo)              │
│                                                                     │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Auth &  │ │  Ledger  │ │  FX /   │ │  Crypto  │ │ Brokerage │  │
│  │Identity │ │ Service  │ │Conversion│ │ Service  │ │  Adapter  │  │
│  │ Module  │ │          │ │ Engine  │ │          │ │           │  │
│  └─────────┘ └──────────┘ └─────────┘ └──────────┘ └───────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌───────────┐  │
│  │Payment  │ │  Risk    │ │  Card   │ │Compliance│ │Notification│  │
│  │ Rails   │ │ Engine   │ │ Service │ │  Module  │ │  Service  │  │
│  └─────────┘ └──────────┘ └─────────┘ └──────────┘ └───────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                      DATA LAYER                                     │
│  PostgreSQL (Ledger) │ Redis (Cache/Sessions) │ Kafka (Events)      │
│  S3 (Documents/KYC)  │ ElasticSearch (Logs)                        │
└─────────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                   EXTERNAL INTEGRATIONS                              │
│  Safaricom Daraja │ Binance/Yellowcard │ Fireblocks │ DriveWealth   │
│  Sumsub/Jumio │ Twilio │ Visa/Mastercard Processor │ SWIFT gateway  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase Alpha — Foundation (Weeks 1–3)

**Goal:** Core infrastructure that everything else builds on. Zero user-facing features, 100% critical plumbing.

### Step 1: Project Scaffolding (Days 1–2)
- Initialize NestJS monorepo with Nx workspace
- Structure: `apps/api`, `apps/web`, `apps/whatsapp-bot`, `libs/shared`, `libs/ledger`, `libs/crypto`, `libs/payments`
- Configure TypeScript strict mode, ESLint, Prettier
- Set up PostgreSQL with TypeORM (or Prisma — recommend **Prisma** for speed as solo dev)
- Redis connection for caching & sessions
- Docker Compose for local development (Postgres, Redis, Kafka)
- CI/CD pipeline: GitHub Actions → AWS ECR → ECS Fargate
- Environment config management (AWS Secrets Manager)

### Step 2: Database Schema & Ledger Core (Days 3–7) *depends on Step 1*

**The ledger is the heart of Koya.** Every financial operation flows through it.

#### Core Tables:

```
users
  id (uuid, PK)
  email (unique, encrypted)
  phone (unique, encrypted)  
  full_name (encrypted)
  country_code
  kyc_status (enum: none, guest, basic, full)
  kyc_tier (enum: guest, standard, premium)
  status (enum: active, suspended, frozen, closed)
  created_at, updated_at

wallets
  id (uuid, PK)
  user_id (FK → users)
  currency (enum: KES, USD, BTC, USDC, USDT)
  balance (decimal, 18 precision)
  available_balance (decimal, 18 precision)
  locked_balance (decimal, 18 precision)  
  status (enum: active, frozen)
  UNIQUE(user_id, currency)

ledger_accounts
  id (uuid, PK)
  account_type (enum: user_wallet, treasury, fee_revenue, settlement, suspense)
  currency (enum: KES, USD, BTC, USDC, USDT)
  reference_id (nullable — links to wallet_id or system account name)
  balance (decimal, 18 precision)

ledger_entries
  id (uuid, PK)
  transaction_id (FK → transactions)
  ledger_account_id (FK → ledger_accounts)
  entry_type (enum: debit, credit)
  amount (decimal, 18 precision)
  running_balance (decimal, 18 precision)
  created_at (immutable)

transactions
  id (uuid, PK)
  idempotency_key (unique)
  type (enum: deposit, withdrawal, conversion, transfer, trade, card_auth, fee)
  status (enum: pending, processing, completed, failed, reversed)
  source_currency
  target_currency
  source_amount (decimal)
  target_amount (decimal)
  exchange_rate (decimal)
  fee_amount (decimal)
  fee_currency  
  user_id (FK → users)
  metadata (jsonb)
  created_at, completed_at

conversion_quotes
  id (uuid, PK)
  user_id (FK)
  source_currency
  target_currency
  source_amount
  target_amount
  exchange_rate
  spread_bps (basis points)
  expires_at
  status (enum: pending, accepted, expired, executed)

kyc_records
  id (uuid, PK)
  user_id (FK → users)
  provider (enum: sumsub, jumio, iprs)
  verification_type (enum: id_document, selfie, address, aml_screening)
  status (enum: pending, approved, rejected, expired)
  provider_reference
  metadata (jsonb — encrypted)
  created_at

risk_events
  id (uuid, PK)
  user_id (FK)
  transaction_id (FK, nullable)
  event_type (enum: login, transaction, kyc_change, device_change)
  risk_score (integer 0-100)
  signals (jsonb)
  action_taken (enum: allow, flag, block, require_2fa)
  created_at
```

#### System Accounts (seeded):
```
Treasury KES, Treasury USD, Treasury BTC, Treasury USDC, Treasury USDT
Fee Revenue KES, Fee Revenue USD, Fee Revenue BTC
Settlement KES, Settlement BTC, Settlement USDC, Settlement USDT
Suspense (for in-flight transactions)
```

#### Ledger Invariants (enforced in code + DB constraints):
- Sum of all debits = Sum of all credits (always, globally)
- User wallet balance = Sum of all ledger entries for that account
- No negative balances on user wallets
- Every transaction creates exactly 2+ ledger entries (double-entry)
- All writes wrapped in PostgreSQL transactions with SERIALIZABLE isolation
- Idempotency keys prevent duplicate processing

### Step 3: Auth & Identity Module (Days 5–8) *parallel with Step 2 (days 5–7)*
- Phone number + OTP authentication (Twilio Verify or Africa's Talking)
- Email + password as secondary auth method
- JWT access tokens (15 min) + refresh tokens (30 days, rotating)
- Google OAuth integration (GCP)
- Device fingerprinting (store device_id, IP, user-agent per session)
- Rate limiting on auth endpoints (5 attempts/minute)
- Session management in Redis
- RBAC: `user`, `admin`, `system` roles

### Step 4: KYC/AML Pipeline (Days 8–12) *depends on Step 3*

Three KYC tiers:

| Tier | Requirements | Limits |
|------|-------------|--------|
| Guest | Name + National ID + IPRS check | 100K KES/day, 300K KES/month |
| Standard | Full ID doc + selfie + address (Sumsub/Jumio) | 1M KES/day, 5M KES/month |  
| Premium | Enhanced due diligence + source of funds | Unlimited |

- **Kenya users:** Jumio for document verification + IPRS API for national ID validation
- **Global users:** Sumsub for document + biometric verification
- AML screening: Sumsub built-in sanctions/PEP screening (or ComplyAdvantage)
- Ongoing transaction monitoring: Rule engine that flags suspicious patterns
- Webhook handlers for async verification status updates
- KYC status stored encrypted, documents stored in S3 with encryption at rest

### Step 5: Notification Service (Days 10–12) *parallel with Step 4*
- SMS via Africa's Talking (Kenya) / Twilio (global)
- Email via AWS SES
- Push notifications (for future mobile apps) via Firebase Cloud Messaging
- In-app notification center (WebSocket for real-time)
- Templates: OTP, transaction confirmation, conversion receipt, KYC status, security alerts
- Notification preferences per user

---

## Phase Beta — Core Product (Weeks 4–7)

**Goal:** The actual product people use. Conversion engine + wallets + payments + web app.

### Step 6: Multi-Currency Wallet System (Days 13–16) *depends on Steps 2, 3*
- Auto-create 5 wallets (KES, USD, BTC, USDC, USDT) on user registration
- Balance queries with available vs locked amounts
- Transaction history per wallet with pagination
- Wallet-level spending limits based on KYC tier
- Internal transfers between own wallets (instant, via ledger)
- Peer-to-peer transfers (Koya user → Koya user) by phone number or email

### Step 7: Conversion/FX Engine (Days 15–22) *depends on Step 6*

**The conversion engine is Koya's core product differentiator.**

#### Supported Pairs (full matrix):
```
KES ↔ BTC    KES ↔ USD    KES ↔ USDT   KES ↔ USDC
BTC ↔ USD    BTC ↔ USDT   BTC ↔ USDC
USDT ↔ USD   USDC ↔ USD   USDT ↔ USDC
```

#### Quote Engine:
- Fetches real-time prices from multiple sources
- Applies Koya spread (revenue): 0.5% – 1.5% depending on pair and volume
- Quote valid for 30 seconds (configurable)
- Prices cached in Redis (5 second TTL for volatile pairs, 30 sec for stablecoin/stablecoin)

#### Liquidity Strategy (CRITICAL for solo operator):

| Pair Category | Recommended Source | Backup |
|--------------|-------------------|--------|
| BTC ↔ USD/USDT/USDC | Binance Spot API | Kraken API |
| USDT ↔ USDC | 1:1 with tiny spread (internal) | Binance |
| USDC ↔ USD | 1:1 via stablecoin custodian/Circle | Internal |
| KES ↔ USD | Sponsor bank FX / Flutterwave | TransferZero |
| KES ↔ BTC | Route through KES→USD→BTC | Yellowcard API |
| KES ↔ USDT/USDC | Route through KES→USD→stablecoin | P2P matching |

**Key insight:** Most KES pairs should be routed through USD as intermediary. You don't need 10 direct liquidity pools — you need 3 (KES↔USD, BTC↔USD, stablecoin↔USD) and route everything else through these.

#### Execution Flow:
1. User requests quote (source currency, target currency, amount)
2. Quote engine fetches best price, adds spread, returns quote with `quote_id`
3. User accepts quote within TTL
4. Execution engine:  
   a. Lock source funds (wallet.available_balance -= amount)  
   b. Execute against liquidity source (Binance trade, FX transfer, etc.)  
   c. On success: Create ledger entries (debit source wallet, credit target wallet, credit fee account)  
   d. On failure: Unlock funds, mark transaction failed  
5. Send confirmation notification

### Step 8: M-Pesa Integration (Days 20–26) *depends on Step 6*

#### Deposits (M-Pesa → Koya KES Wallet):
- STK Push via Safaricom Daraja API
- User enters amount → STK push sent → user enters PIN on phone → callback received
- Ledger: Debit M-Pesa Settlement Account, Credit User KES Wallet
- Implement callback URL with HMAC validation
- Idempotent callback handling (M-Pesa sends duplicates)

#### Withdrawals (Koya KES Wallet → M-Pesa):
- B2C API via Daraja
- User enters phone + amount → Compliance check → B2C request → callback
- Ledger: Debit User KES Wallet, Credit M-Pesa Settlement Account
- Queue withdrawals for batch processing during off-peak (cost optimization)
- Withdrawal limits per KYC tier

#### Paybill Collections:
- For merchant payments and bill splits
- Useful for Phase 4 merchant products

#### Technical Details:
- Daraja API consumer key/secret stored in AWS Secrets Manager
- Separate sandbox and production configs
- Retry logic with exponential backoff for failed callbacks
- Transaction reconciliation job (daily, compares Koya ledger vs M-Pesa statements)

### Step 9: Guest Conversion System (Days 22–26) *depends on Steps 7, 4*
- No account required
- Collect: Name, Phone, National ID number
- IPRS verification (Kenya National ID lookup)
- AML screening (Sumsub)
- If clean: Generate quote → Execute → Send M-Pesa disbursement or crypto to provided address
- Daily limit: 100K KES, Monthly: 300K KES
- Accessible via Web and WhatsApp
- After 3 guest conversions: Prompt to create full account

### Step 10: Web Application — Core (Days 18–30) *parallel with Steps 7–9 (frontend work)*

**Stack:** Next.js 15 (App Router), Tailwind CSS, shadcn/ui on top of Radix UI, Framer Motion for animations

#### Design System:
- Dark-first UI with premium vault aesthetic
- Color palette: Vault Black (#0A0A0A), Deep Navy (#0A0E27), 24K Gold gradient (#F0D060 → #D4AF37 → #A88520), Emerald (#10B981)
- Glass cards: `backdrop-blur-xl bg-white/5 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.45)]`
- Typography: Inter (body/UI), Space Grotesk (balances & headings with tabular numbers)
- Animations: Subtle micro-interactions, balance count-ups, smooth slide/fade transitions (150–250ms ease-out)
#### Pages & Components:

**Public:**
- Landing page (hero, features, social proof, CTA)
- Guest swap page (simple conversion form)
- About / Legal / Terms

**Auth:**
- Phone OTP login
- Email login
- Google OAuth
- KYC onboarding wizard (step-by-step, upload ID, selfie, address)

**Dashboard:**
- Portfolio overview (total value in USD, 24h change)
- Balance cards for each wallet (KES, USD, BTC, USDC, USDT)
- Quick action buttons: Convert, Deposit, Withdraw, Send
- Recent transactions list
- Price charts (lightweight TradingView widget or recharts)

**Conversion:**
- Two-panel swap interface (From → To)
- Real-time quote with spread displayed
- Confirmation modal with full breakdown
- Animated success state

**Wallets:**
- Individual wallet detail pages
- Deposit/withdrawal flows (M-Pesa for KES, crypto address for BTC/USDC/USDT, wire for USD)
- Transaction history with filters

**Settings:**
- Profile management
- Security (2FA, active sessions, trusted devices)
- Notification preferences
- KYC status & document management

---

## Phase Gamma — Extended Product (Weeks 8–10)

**Goal:** Differentiation features — stocks, cards, WhatsApp, mobile.

### Step 11: WhatsApp Bot — Full Transactional (Days 31–38) *depends on Steps 6, 7, 8*

**Platform:** Twilio WhatsApp Business API (or Meta Cloud API directly)

#### Conversation Flows:

**Onboarding:**
```
User: "Hi"
Bot: "Welcome to Koya Bank 🏦 The borderless financial operating system.
      Reply with:
      1️⃣ Quick Swap (no account needed)
      2️⃣ Create Account  
      3️⃣ Login to Account
      4️⃣ Check Rates"
```

**Guest Swap (no account):**
```
User: "1" 
Bot: "Quick Swap! What would you like to convert?
      Example: 50000 KES to BTC
      Or: 0.01 BTC to KES"
User: "50000 KES to BTC"
Bot: "📊 Quote: 50,000 KES → 0.00341 BTC
      Rate: 1 BTC = 14,662,756 KES
      Fee: 500 KES
      Expires in 30 seconds.
      Reply YES to confirm."
```

**Authenticated Commands:**
```
BAL         → View all balances
SEND 1000 KES to 0712345678 → P2P transfer  
SWAP 100 USD to BTC → Conversion
DEPOSIT     → Get M-Pesa paybill / crypto address
WITHDRAW 5000 KES → M-Pesa withdrawal
HISTORY     → Last 5 transactions
RATES       → Current exchange rates
STOCKS      → Portfolio summary
HELP        → Command list
```

**Security:**
- Session-based auth via phone number (OTP verification)
- Transaction PIN for amounts > 10,000 KES
- Session timeout: 10 minutes of inactivity
- IP/device logging per WhatsApp session

### Step 12: Stablecoin Infrastructure (Days 33–38) *parallel with Step 11*
- USDC as primary reserve for USD wallets
- Integration with Circle (USDC minting/redeeming) or custody through Fireblocks
- User deposits USDC → credited to USDC wallet
- User can "hold USD" which is backed 1:1 by USDC in custody
- USDT integration via Tether on Ethereum/Tron
- Display: Users see "USD balance" but backend maintains USDC/USDT reserve tracking
- Reserve transparency page (total USD liabilities vs USDC reserves)

### Step 13: US Stock Trading (Days 36–42) *depends on Step 6*

**Broker:** DriveWealth API

#### Capabilities:
- Fractional shares (buy $10 of Apple)
- US equities + major ETFs (S&P 500, QQQ, etc.)
- Market orders + limit orders
- Curated stock lists ("Popular", "Tech Giants", "ETFs", "Dividend")

#### Trade Flow:
1. User selects stock, enters USD amount
2. Convert from any wallet to USD (if needed) — uses Conversion Engine
3. Submit order to DriveWealth
4. DriveWealth executes, returns confirmation
5. Update portfolio in Koya DB
6. Settlement T+1 (handle in background)

#### UI:
- Stock browsing with search
- Individual stock page (price chart, company info, buy/sell)
- Portfolio view (holdings, P&L, allocation pie chart)
- Order history

### Step 14: Card Infrastructure (Days 40–48) *parallel with Step 13*

**Card Issuer:** Partner with a card processor (Marqeta, Stripe Issuing, or Africa-focused: Sudo Africa, Union54)

#### Card Types:
- **Virtual card** (instant issuance) — for online purchases
- **Physical premium card** (metal, custom design) — mailed
- **Disposable virtual card** — single-use, privacy-focused

#### Features:
- Fund from any wallet (auto-convert to transaction currency)
- Real-time authorization webhooks
- Wallet selection per card (default: USD wallet)
- Card controls: freeze/unfreeze, region lock, merchant category blocks, spending limits
- Transaction notifications (push + in-app)
- 1% BTC cashback on all card purchases (competitive with Xapo)

#### Ledger Integration:
- Card authorization: Lock funds in wallet
- Card settlement (T+1): Debit wallet, credit card settlement account
- Refunds: Credit wallet, debit card settlement account

### Step 15: Mobile Apps (Days 38–50) *parallel with Steps 13, 14*

**Stack:** React Native (Expo) for iOS + Android

- Share component library with web (design tokens, API client)
- Biometric auth (Face ID / fingerprint)
- Push notifications via Firebase
- Offline-capable balance viewing (cached)
- Deep links for WhatsApp → App handoff
- Feature parity with web dashboard

Priority screens:
1. Dashboard (balances, quick actions)
2. Conversion/swap
3. Wallet detail + deposit/withdraw
4. Transaction history
5. Stock trading
6. Card management
7. Settings & security

---

## Phase Delta — Hardening & Launch (Weeks 11–12)

### Step 16: Risk Engine (Days 49–52) *depends on all previous*
- Real-time risk scoring on every transaction
- Signals: transaction velocity, amount anomaly, device fingerprint, geo mismatch, time-of-day patterns
- Rule engine:
  - > 500K KES single transaction → flag for review
  - > 3 devices in 24 hours → require re-auth
  - New device + large withdrawal → block, notify user
  - Cross-border pattern inconsistent with profile → flag
- AML transaction monitoring: Daily batch analysis
- Suspicious Activity Reports (SAR) generation for compliance team

### Step 17: Observability & Monitoring (Days 50–53) *parallel with Step 16*
- Prometheus metrics (transaction volume, conversion latency, error rates)
- Grafana dashboards (business KPIs + system health)
- OpenTelemetry distributed tracing across services
- Structured logging → ElasticSearch (or AWS CloudWatch)
- Alerting: PagerDuty / Opsgenie for P0 incidents
- Uptime monitoring: External health checks on critical paths
- Financial reconciliation alerts (ledger imbalance = P0)

### Step 18: Security Hardening (Days 52–55)
- Penetration testing checklist (OWASP Top 10)
- Rate limiting on all public endpoints
- Input validation & sanitization everywhere
- SQL injection prevention (parameterized queries via Prisma)
- XSS prevention (React auto-escapes, CSP headers)
- CSRF protection (SameSite cookies + CSRF tokens)
- Secrets rotation procedure
- Encryption at rest (PostgreSQL TDE, S3 encryption)
- Encryption in transit (TLS 1.3 everywhere)
- API key rotation schedule
- Audit logging (who did what, when, from where)

### Step 19: Compliance & Legal Prep (Days 53–56) *parallel with Step 18*
- Terms of Service
- Privacy Policy (GDPR + Kenya Data Protection Act compliant)
- AML/KYC Policy documentation
- Risk assessment documentation
- Transaction monitoring rules documentation
- Data retention policy (7 years for financial records)
- Prepare CBK engagement materials (for future licensing)

### Step 20: Load Testing & Launch (Days 55–60)
- Load test: k6 scripts simulating 1000 concurrent users
- Stress test conversion engine under 100 req/sec
- Database query optimization (EXPLAIN ANALYZE critical queries)
- Redis cache warming strategy
- CDN for static assets (CloudFront)
- Blue-green deployment setup
- Launch checklist:
  - [ ] All integration sandbox → production migrations
  - [ ] DNS + SSL configured
  - [ ] Monitoring dashboards live
  - [ ] On-call rotation (even if solo — phone alerts)
  - [ ] Seed liquidity in exchange accounts
  - [ ] First 50 beta users onboarded
  - [ ] Guest swap flow tested end-to-end
  - [ ] KYC flow tested with real documents
  - [ ] M-Pesa production credentials active

---

## Infrastructure & Deployment

### AWS Architecture:
```
Route 53 (DNS)
    │
CloudFront (CDN — static assets, web app)
    │
ALB (Application Load Balancer)
    │
ECS Fargate (API containers — auto-scaling)
    │
├── RDS PostgreSQL (Multi-AZ, encrypted, automated backups)
├── ElastiCache Redis (cluster mode)
├── MSK (Managed Kafka)
├── S3 (KYC documents, encrypted)
├── Secrets Manager (API keys, DB credentials)
├── SQS (async job queue — fallback for Kafka)
├── Lambda (webhook handlers, reconciliation jobs)
└── CloudWatch (logs, basic monitoring)
```

### Estimated AWS Costs (MVP scale):
- RDS (db.t3.medium): ~$70/month
- ECS Fargate (2 tasks): ~$60/month
- ElastiCache (cache.t3.micro): ~$15/month
- ALB: ~$25/month
- S3 + CloudFront: ~$10/month
- Total: ~$200–350/month at MVP scale

### DigitalOcean / Scaleway (secondary):
- Staging environment
- Development databases
- Cost savings for non-critical workloads

---

## Revenue Model — MVP Mechanics

### Conversion Spread (Primary Revenue):
| Pair Type | Spread (bps) | Example |
|-----------|-------------|---------|
| Crypto ↔ Fiat | 100-150 bps | BTC→KES: user pays 1-1.5% |
| Crypto ↔ Crypto | 50-75 bps | BTC→USDT: user pays 0.5-0.75% |
| Stablecoin ↔ Stablecoin | 10-25 bps | USDC→USDT: user pays 0.1-0.25% |
| Fiat ↔ Fiat | 75-100 bps | KES→USD: user pays 0.75-1% |

### Additional Revenue:
- **Card interchange:** ~0.5-1% of card transaction value
- **BTC cashback cost:** Offset by interchange revenue
- **Stock trading:** Commission per trade (or spread on DriveWealth)
- **Premium tier (future):** Monthly subscription for enhanced limits, priority support

---

## Relevant Files (Project Structure)

```
koya/
├── apps/
│   ├── api/                          — NestJS backend application
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── auth/                 — Auth module (JWT, OTP, OAuth)
│   │   │   ├── users/                — User management
│   │   │   ├── wallets/              — Multi-currency wallet logic
│   │   │   ├── ledger/               — Double-entry ledger core
│   │   │   ├── conversion/           — FX/conversion engine
│   │   │   ├── payments/             — M-Pesa, bank transfers
│   │   │   ├── crypto/               — Crypto operations, custody
│   │   │   ├── trading/              — Stock trading (DriveWealth)
│   │   │   ├── cards/                — Card issuance & management
│   │   │   ├── kyc/                  — KYC/AML pipeline
│   │   │   ├── risk/                 — Risk scoring engine
│   │   │   ├── notifications/        — SMS, email, push
│   │   │   ├── whatsapp/             — WhatsApp bot handlers
│   │   │   └── common/               — Guards, interceptors, filters
│   │   └── prisma/
│   │       └── schema.prisma         — Database schema
│   ├── web/                          — Next.js web application
│   │   ├── app/
│   │   │   ├── (public)/             — Landing, guest swap
│   │   │   ├── (auth)/               — Login, register, KYC
│   │   │   ├── (dashboard)/          — Main app (wallets, convert, trade)
│   │   │   └── api/                  — Next.js API routes (BFF)
│   │   ├── components/
│   │   │   ├── ui/                   — Design system (glassmorphism)
│   │   │   ├── dashboard/            — Dashboard components
│   │   │   ├── conversion/           — Swap interface
│   │   │   ├── wallets/              — Wallet cards, history
│   │   │   ├── trading/              — Stock trading UI
│   │   │   └── cards/                — Card management UI
│   │   └── lib/                      — API client, hooks, utils
│   ├── mobile/                       — React Native (Expo) app
│   └── whatsapp/                     — WhatsApp bot service
├── libs/
│   ├── shared/                       — Shared types, DTOs, constants
│   ├── ledger/                       — Ledger primitives (shared logic)
│   └── crypto/                       — Crypto utilities
├── docker-compose.yml
├── .github/workflows/ci.yml
└── infrastructure/
    └── terraform/                    — AWS IaC
```

---

## Verification Plan

1. **Ledger integrity test:** Write a test suite that performs 10,000 random transactions and asserts total debits = total credits, all balances >= 0, and every transaction has matching entry pairs
2. **Conversion engine test:** Test all 10 currency pairs with mock exchange data, verify spread calculation accuracy to 6 decimal places
3. **M-Pesa integration test:** End-to-end test on Safaricom sandbox — STK push deposit → balance update → B2C withdrawal
4. **Guest swap E2E test:** Full flow from landing page → ID input → IPRS mock → quote → execute → receipt
5. **Auth security test:** Verify rate limiting (6th login attempt blocked), JWT expiry, refresh token rotation, session invalidation
6. **WhatsApp bot test:** Simulate full conversation flows for: guest swap, balance check, conversion, deposit, withdrawal
7. **Stock trading test:** Place order on DriveWealth sandbox, verify portfolio update
8. **Load test:** k6 script — 500 concurrent users performing conversions, target < 2 second p95 latency
9. **Reconciliation test:** Intentionally create mismatched state, verify reconciliation job catches it
10. **Card authorization test:** Simulate Visa/Mastercard auth webhook, verify balance lock + notification

---

## Decisions & Assumptions

1. **Monorepo over microservices:** As a solo developer, a NestJS monorepo with well-separated modules is faster than managing 10 microservices. The module boundaries are designed so you can extract to microservices later when you have a team.

2. **Prisma over TypeORM:** Prisma gives you type-safe database access, automatic migrations, and a great developer experience. Critical for a solo dev moving fast.

3. **Liquidity routing through USD:** Instead of maintaining 10+ direct liquidity pools, route most conversions through USD as the intermediate currency. This reduces complexity from O(n²) liquidity pools to O(n).

4. **No own banking license initially:** Operate under a sponsor bank model (or as a technology provider). Engage CBK for licensing path in parallel with building. This is the standard approach (Xapo started with Bitcoin custody, added banking license later through Gibraltar).

5. **Fireblocks for crypto custody:** While expensive, Fireblocks provides MPC wallets, policy engine, and regulatory compliance out of the box. For MVP, you can start with a simpler setup (e.g., BitGo or even self-custody with proper key management) and upgrade.

6. **React Native over native iOS/Android:** As a solo developer, code reuse is essential. Expo + React Native gives you both platforms with ~90% shared code.

7. **Guest swaps as growth wedge:** This is your user acquisition funnel. No sign-up friction → demonstrate value → convert to full accounts. Xapo requires membership application — Koya's openness is a competitive advantage.

8. **WhatsApp as distribution channel:** 97% of Kenyans with smartphones use WhatsApp. A full transactional bot isn't just a feature — it's market access to users who won't download another app.

---

## Critical Risk Factors

1. **Regulatory:** Operating without a license is the #1 risk. Mitigate: Engage a Kenyan fintech lawyer immediately. Consider launching under a sandbox/pilot license from CBK Innovation Hub. Research if you can operate as a "technology platform" with a licensed partner.

2. **Liquidity:** You need funded exchange accounts with sufficient BTC, USDC, USDT, and KES liquidity before launch. Under-capitalized liquidity = failed conversions = dead product.

3. **Solo developer risk:** This plan is executable but demanding. Prioritize ruthlessly: Launch with guest swaps + web wallets first, then layer features. Don't try to ship everything on Day 60.

4. **M-Pesa production access:** Getting Daraja production credentials requires a registered Kenyan business entity and compliance review. Start the application process in Week 1.

---

## Realistic Solo Developer Sequencing

Given you're solo, here's the honest priority order if time runs short:

**Must ship (Week 1–6):**
- Ledger + Auth + KYC pipeline
- Multi-currency wallets
- Conversion engine (start with BTC↔KES, BTC↔USDT, USDT↔KES)
- M-Pesa deposits/withdrawals
- Guest swap (web)
- Web dashboard (core flows)

**Should ship (Week 7–9):**
- WhatsApp bot (basic: rates, guest swaps)
- All conversion pairs
- Stablecoin infrastructure
- Risk engine (basic rules)

**Can defer (Week 10–12):**
- Stock trading
- Card issuance
- Mobile apps
- Full WhatsApp transactional bot
- Advanced risk engine

This sequencing ensures you have a **working, revenue-generating product** even if Phase Gamma slips.
