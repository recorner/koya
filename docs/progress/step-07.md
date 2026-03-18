# Step 07 — WhatsApp Guest Conversion v1

**Status:** Complete  
**Date:** 2026-03-18

---

## Scope

Build a WhatsApp-based conversational interface for KES → BTC guest conversion, layered on top of the existing conversion engine. Users interact via WhatsApp messages (Twilio) to get quotes, submit identity, provide a BTC address, and initiate M-Pesa payment — all without a web browser.

**Goal:** A guest user can complete a full KES → BTC conversion entirely through WhatsApp, using the same backend services as the web flow.

---

## Architecture

```
Twilio Webhook
    ↓
WhatsAppController (POST /api/v1/whatsapp/webhook)
    ↓
WhatsAppService (orchestrator)
    ├── IdempotencyService (dedup via MessageSid)
    ├── SessionService (conversation state CRUD)
    ├── ParserService (command/amount/address parsing)
    ├── FlowHandler (step-by-step routing → ConversionService)
    └── TemplateService (outbound message formatting)

EventEmitter Bridge:
    PaymentsController → 'payment.confirmed' → ConversionService
    ConversionService → 'conversion.completed' → NotificationListener → WhatsAppService
```

### Key Design Decisions

1. **Thin orchestration layer** — WhatsApp services only handle messaging concerns. All business logic lives in ConversionService/RiskService/etc.
2. **Adapter pattern for Twilio** — `TWILIO_ADAPTER` DI token with `TwilioAdapter` interface, real and mock implementations. Easy to swap for tests.
3. **EventEmitter bridge** — Decouples M-Pesa payment callback from WhatsApp notification. PaymentsController emits `payment.confirmed`, ConversionService processes it and emits `conversion.completed`, NotificationListener sends WhatsApp message.
4. **Separate flow step enum** — `WhatsAppFlowStep` tracks chat UX state independently from the 15-state conversion state machine.

---

## WhatsApp Conversation Flow

```
User: "hi"           → IDLE → Welcome menu
User: "1" (Convert)  → MENU → WAITING_FOR_AMOUNT
User: "1000"         → Creates quote → WAITING_FOR_QUOTE_CONFIRMATION
User: "YES"          → Locks quote, creates session → WAITING_FOR_FULL_NAME
User: "John Doe"     → Stored in metadata → WAITING_FOR_DOCUMENT_NUMBER
User: "12345678"     → Stored in metadata → WAITING_FOR_EMAIL
User: "SKIP"         → Batch identity submit → WAITING_FOR_BTC_ADDRESS
User: "1BvBMSE..."   → Submit payout details → WAITING_FOR_PAYMENT_CONFIRMATION
User: "PAY"          → Initiate payment → PROCESSING
User: "REF ABC123"   → Submit M-Pesa reference → COMPLETED
```

### Global Commands (available at any step)
- `HELP` — Show available commands
- `CANCEL` — Reset conversation to IDLE
- `STATUS` — Show current conversion status (when session exists)
- `START OVER` — Same as CANCEL

---

## Files Created

| File | Purpose |
|------|---------|
| `src/providers/twilio-adapter.interface.ts` | TwilioAdapter interface + TWILIO_ADAPTER DI token |
| `src/providers/twilio.adapter.ts` | Real Twilio SDK adapter |
| `src/providers/mock-twilio.adapter.ts` | Mock adapter for dev/test |
| `src/whatsapp/whatsapp-parser.service.ts` | Parse inbound messages into typed commands |
| `src/whatsapp/whatsapp-template.service.ts` | Format all outbound reply messages |
| `src/whatsapp/whatsapp-idempotency.service.ts` | Dedup via Twilio MessageSid |
| `src/whatsapp/whatsapp-session.service.ts` | Conversation state CRUD + TTL |
| `src/whatsapp/whatsapp-flow.handler.ts` | Step-by-step flow routing to ConversionService |
| `src/whatsapp/whatsapp.service.ts` | Main orchestrator (rate limiting, pipeline) |
| `src/whatsapp/whatsapp.controller.ts` | POST /whatsapp/webhook endpoint |
| `src/whatsapp/whatsapp-notification.listener.ts` | EventEmitter listener for conversion.completed |
| `src/whatsapp/whatsapp.module.ts` | Module definition |

## Files Modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added WhatsAppConversation, WhatsAppMessageEvent models + enums |
| `src/app/app.module.ts` | Added EventEmitterModule.forRoot() + WhatsAppModule |
| `src/conversion/conversion.module.ts` | Added `exports: [ConversionService]` |
| `src/conversion/conversion.service.ts` | Added EventEmitter2 DI, payment.confirmed handler, conversion.completed emission |
| `src/payments/payments.controller.ts` | Added EventEmitter2 emission of payment.confirmed |

## Tests Created

| File | Tests | Type |
|------|-------|------|
| `__tests__/whatsapp-parser.service.spec.ts` | 20+ | Unit |
| `__tests__/whatsapp-template.service.spec.ts` | 15+ | Unit |
| `__tests__/whatsapp-flow.handler.spec.ts` | 10+ | Unit |
| `__tests__/whatsapp.integration.spec.ts` | 8 | Integration |

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio account identifier | `mock_twilio_sid` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `mock_twilio_token` |
| `TWILIO_WHATSAPP_NUMBER` | Sender number | `whatsapp:+14155238886` |
| `WHATSAPP_SESSION_TTL_MINUTES` | Conversation timeout | `10` |
| `WHATSAPP_RATE_LIMIT_PER_MINUTE` | Max messages per phone per minute | `20` |
| `WHATSAPP_WEBHOOK_URL` | Public webhook URL for Twilio | — |

---

## Safeguards

- **Idempotency**: Duplicate Twilio MessageSid silently ignored
- **Rate limiting**: In-memory sliding window per phone number (configurable via env)
- **Session TTL**: Conversations expire after configurable minutes of inactivity
- **PII masking**: Phone, document numbers, BTC addresses, tx hashes masked in outbound messages
- **Input validation**: Reuses existing validation (KES 100–100K range, BTC address regex, E.164 phone)
- **Guest limits**: Enforced by existing ConversionService (daily 100K KES, monthly 300K KES)

---

## V1 Limitations

1. Mock Twilio adapter in use — no real SMS delivery yet
2. No Twilio signature verification on webhook (needs production URL)
3. Single document type (NATIONAL_ID) and country (KE) hardcoded
4. In-memory rate limiter (resets on restart — fine for single instance)
5. No webhook retry handling from Twilio
6. No conversation history/pagination for STATUS command

---

## Test Results

```
Test Suites: 8 passed, 8 total
Tests:       105 passed, 105 total
```

All existing tests continue to pass — zero regressions.
