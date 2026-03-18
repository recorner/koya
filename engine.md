You are working inside the Koya monorepo.

First, study the existing guest conversion implementation before making any changes. Do not code blindly. Read the current backend, shared types, frontend conversion flow, and docs so you fully understand how the existing guest KES → BTC engine works.

## Goal

Build **WhatsApp Guest Conversion v1** using the existing **Twilio account for testing**.

This must let a user complete the already implemented **guest KES → BTC** conversion flow through WhatsApp, while reusing the current NestJS conversion engine, Prisma models, validation, payment flow, and state machine as much as possible.

This is a **channel extension**, not a rewrite.

---

## Study first

Before writing code, inspect at minimum:

- `apps/api/src/conversion/*`
- `apps/api/src/payments/*`
- `apps/api/src/kyc/*`
- `apps/api/src/risk/*`
- `apps/api/src/providers/*`
- `apps/api/src/common/validation.utils.ts`
- `apps/api/prisma/schema.prisma`
- `libs/types/src/lib/*`
- `apps/web/components/conversion/*`
- any docs for the guest conversion vertical slice

Understand:
- quote creation
- session creation
- identity submission
- payout submission
- payment initiation
- M-Pesa callback handling
- manual reference confirmation
- state transition enforcement
- mock provider DI setup

Only after this analysis should you implement WhatsApp support.

---

## Core architecture rule

Do not build a separate conversion engine for WhatsApp.
Do not duplicate quote, session, KYC, payout, payment, or processing logic.

WhatsApp must be a **thin conversation/orchestration layer** on top of the existing backend services.

Reuse:
- existing conversion services
- existing payment services
- existing KYC/compliance services
- existing validation utilities
- existing route policy
- existing state machine

---

## Scope

Support only this v1 flow:
- channel: WhatsApp
- user type: guest
- route: KES → BTC
- payment source: M-Pesa
- payout: BTC
- one active conversion per WhatsApp phone number

Do not add:
- authenticated account flows
- other conversion routes
- balances
- withdrawals
- full WhatsApp banking features

---

## Twilio

Use the existing Twilio account for testing.

Implement WhatsApp using Twilio inbound webhooks and outbound message sending.

Assume sandbox or existing test setup is acceptable for development.

Keep Twilio integration encapsulated in the WhatsApp module. Do not scatter Twilio calls across the codebase.

---

## What to build

Create a new backend module, for example:

- `apps/api/src/whatsapp/whatsapp.module.ts`
- `apps/api/src/whatsapp/whatsapp.controller.ts`
- `apps/api/src/whatsapp/whatsapp.service.ts`
- `apps/api/src/whatsapp/whatsapp-session.service.ts`
- `apps/api/src/whatsapp/whatsapp-parser.service.ts`
- `apps/api/src/whatsapp/whatsapp-template.service.ts`
- `apps/api/src/whatsapp/whatsapp-idempotency.service.ts`

Naming can vary slightly if justified, but keep the module clean and explicit.

---

## New endpoint

Add:

- `POST /api/v1/whatsapp/webhook`

This endpoint should:
- accept inbound Twilio WhatsApp messages
- validate or verify Twilio requests if feasible in current setup
- normalize incoming payloads
- deduplicate inbound messages using Twilio message SID
- load or create a WhatsApp conversation
- route the message according to current step
- send reply via Twilio

---

## Database additions

Add Prisma models for conversational state and logging.

### `WhatsAppConversation`
Include fields like:
- id
- phoneNumber
- status
- currentIntent
- currentStep
- conversionSessionId
- guestProfileId if useful
- lastInboundAt
- lastOutboundAt
- expiresAt
- metadata JSON
- createdAt
- updatedAt

### `WhatsAppMessageEvent`
Include fields like:
- id
- conversationId
- direction
- twilioMessageSid
- body
- messageType
- payload/rawPayload JSON
- createdAt

Requirements:
- conversation lookup by phone number must be efficient
- Twilio message SID should support idempotency
- design indexes well

---

## WhatsApp-specific flow state

Do not reuse the existing conversion state enum for chat UX.

Create a separate WhatsApp flow step enum, for example:
- `IDLE`
- `MENU`
- `WAITING_FOR_AMOUNT`
- `WAITING_FOR_QUOTE_CONFIRMATION`
- `WAITING_FOR_FULL_NAME`
- `WAITING_FOR_DOCUMENT_NUMBER`
- `WAITING_FOR_EMAIL`
- `WAITING_FOR_BTC_ADDRESS`
- `WAITING_FOR_PAYMENT_CONFIRMATION`
- `WAITING_FOR_REFERENCE`
- `COMPLETED`

This should map onto the existing conversion session lifecycle without replacing it.

---

## User flow to implement

### Entry
If user sends:
- `hi`
- `hello`
- `start`

Reply with a short welcome menu:
- Welcome to Koya
- Reply `1` to convert KES to BTC
- Reply `HELP` for commands
- Reply `CANCEL` anytime to stop

### Start conversion
If user replies `1`:
- set conversion intent
- ask for amount in KES

### Amount
User sends KES amount like `500`, `2500`, `50000`
- validate using existing rules
- create quote using existing quote logic

Reply with:
- KES amount
- BTC amount
- fee
- rate
- quote expiry
- prompt to reply `YES`

### Quote confirmation
If user replies `YES` before expiry:
- create session using existing session logic
- ask for full name

If quote expired:
- handle cleanly, either regenerate or request amount again

### Identity
Collect one message at a time:
1. full name
2. national ID number
3. optional email, allow `SKIP`

Then submit identity using existing identity/KYC flow.

### BTC payout
Ask for BTC address.
Validate using existing BTC validation utility.
If valid, save payout details through existing services.

### Payment
Use WhatsApp sender phone as default M-Pesa phone if appropriate, or ask for confirmation/change if needed.
Require user to reply `PAY`.

On `PAY`:
- call existing payment initiation logic
- initiate STK push
- move to pending step

### Payment pending
Reply telling the user that M-Pesa STK push was sent and they should enter their PIN.

If payment callback confirms:
- send completion message with:
  - guest reference
  - tx hash
  - BTC amount
  - success confirmation

### Manual fallback
If no automatic update arrives, allow:
- `REF <mpesa_reference>`

Use the existing manual reference confirmation flow where possible.
Only allow this while the linked session is actually payment-pending.

---

## Commands

Support globally:
- `HELP`
- `CANCEL`
- `START OVER`
- `STATUS`

Expected behavior:
- `HELP` explains available commands
- `CANCEL` safely ends current flow
- `START OVER` resets chat state and abandons unfinished conversation flow
- `STATUS` returns current conversion/session state when available

---

## Safeguards

Implement:
- one active conversion per phone number
- inbound idempotency using Twilio message SID
- inactivity timeout, e.g. 10 minutes
- no duplicate payment initiation
- no manual reference confirmation unless payment is pending
- mask sensitive values when replying
- lightweight rate limiting if consistent with current stack
- useful structured logs

Do not build a fragile happy-path-only bot.

---

## Notification bridge

Important:
when the existing M-Pesa callback confirms payment for a conversion session created through WhatsApp, the system should automatically send a WhatsApp update through Twilio to the linked user.

Wire this cleanly. Do not hack it in.

---

## Config

Add/update env vars such as:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_NUMBER`
- `WHATSAPP_SESSION_TTL_MINUTES`
- `WHATSAPP_RATE_LIMIT_PER_MINUTE`

Update `.env.example`.

---

## Testing

Add proper tests.

### Unit tests
- parser behavior
- command handling
- flow-step routing
- amount/address/reference parsing and validation behavior

### Integration tests
- inbound webhook creates/resumes conversation
- amount → quote → yes → identity → payout → pay flow
- duplicate inbound message is ignored
- manual reference flow works
- payment callback triggers WhatsApp success notification

### Persistence checks
- conversation state persists correctly
- message events are stored
- expired conversations reset correctly

Do not rely on live Twilio network calls in tests.

---

## Documentation

Create a concise markdown doc covering:
- architecture overview
- how WhatsApp maps to the existing guest conversion engine
- Twilio test setup
- webhook behavior
- supported commands
- v1 limitations

---

## Deliverables

Deliver:
- backend implementation
- Prisma schema updates + migration
- env updates
- tests
- concise docs

Before finalizing, verify:
- TypeScript compiles
- Prisma generates cleanly
- tests pass
- architecture remains clean
- no unnecessary duplication of core business logic
- WhatsApp is implemented as a reusable channel layer over the existing engine