# Database Setup & Testing Plan

## Overview
Connect to DigitalOcean managed PostgreSQL, run migrations, add swap mock provider, write integration + E2E tests.

---

## Phase 1: Database Connection

### 1.1 Configure SSL Connection
- Update `prisma.config.ts` with DigitalOcean connection string + SSL
- Connection string: `postgresql://doadmin:<password>@koya-do-user-30254651-0.g.db.ondigitalocean.com:25060/koya?sslmode=require`
- Reference `postgress.crt` for SSL certificate validation
- Create `.env` with actual credentials (gitignored)

### 1.2 Update PrismaService for SSL
- Prisma v7 requires passing the `datasourceUrl` to the constructor for runtime connections
- Pass `DATABASE_URL` from environment to PrismaService constructor
- Inject `ConfigService` to read `DATABASE_URL`

### 1.3 Run Migration
- `npx prisma migrate dev --name init` to create all tables on DigitalOcean DB
- Verify tables created: `guest_profiles`, `conversion_sessions`, `conversion_quotes`, `payment_instructions`, `payout_instructions`, `conversion_state_events`

---

## Phase 2: Swap Mock Provider

### 2.1 Create SwapProvider Interface
- `apps/api/src/providers/swap-provider.interface.ts`
- Interface: `SwapProvider { executeSwap(input): Promise<SwapResult> }`
- Input: sourceAsset, targetAsset, sourceAmountMinor, targetAmountMinor, referenceCode
- Result: success, executionPrice, executedAmountMinor, executionId

### 2.2 Create MockSwapProvider
- `apps/api/src/providers/mock-swap.provider.ts`
- Simulates swap execution with a small delay
- Returns the quoted amount as executedAmount (mock = no slippage)
- Generates a mock executionId

### 2.3 Wire Into ConversionModule
- Add `SWAP_PROVIDER` token
- Inject MockSwapProvider
- Use in `ConversionService.processPaymentConfirmation()` at the EXECUTION_PENDING step

---

## Phase 3: Integration Tests

### 3.1 Test Infrastructure
- Create `apps/api/test/` directory for integration tests
- Use `@nestjs/testing` `Test.createTestingModule()` to spin up the real NestJS app with real DB
- Each test suite cleans up its own data (delete created records in afterEach)
- Use the actual DigitalOcean DB (no test-specific DB for now — tests clean up after themselves)

### 3.2 Test Cases — `conversion-flow.integration.spec.ts`
1. **Full happy path**: quote → session → identity → payout → payment → callback → completion
2. **Expired quote rejection**: Create quote, wait/manually expire, attempt to create session — should fail
3. **Invalid state transition**: Try to submit payout before identity — should fail
4. **Guest identity dedup**: Same identity creates same guest profile
5. **Duplicate payment callback**: Second callback is idempotent (no error, no state change)
6. **Quote amount validation**: Below min / above max rejected

---

## Phase 4: E2E Tests

### 4.1 Update E2E Setup
- Update `apps/api-e2e/src/support/test-setup.ts` to use port 3333 (API port)
- Tests hit the running API via HTTP (axios)

### 4.2 Test Cases — `conversion.e2e.spec.ts`
1. **Health check**: GET /api/v1/health returns 200
2. **Quote creation**: POST /api/v1/guest-conversion/quote with valid KES→BTC params
3. **Full flow via HTTP**: POST quote → POST session → POST identity → POST payout → POST pay → GET status (poll until COMPLETED)
4. **Validation errors**: Missing fields, invalid amounts, invalid BTC address
5. **Quote expiry via HTTP**: Create quote, force expire, attempt session

---

## Execution Order

1. Configure `.env` with DB credentials → Update `prisma.config.ts` → Update `PrismaService`
2. Run `prisma migrate dev` to create tables
3. Create swap mock provider + wire it
4. Start API server, verify connection
5. Write integration tests
6. Write E2E tests
7. Run all tests, verify green
