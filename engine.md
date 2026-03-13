# Build Koya Guest Conversion Entry Point

Build the **guest conversion engine entrypoint behind the landing page** for **one complete route only: KES → BTC**.

## Goal

Deliver one working vertical slice for **web guest conversion**:

**Landing page CTA → guest conversion page → quote → confirm → collect identity → collect BTC address → initiate M-Pesa STK push → wait for payment callback → execute mock conversion → show final status**

Design the backend so the **same workflow can later be reused by WhatsApp via Twilio**.

---

## Scope

Build only this route and flow:

- **Route:** KES → BTC
- **Mode:** guest
- **Channel now:** web
- **Future compatibility:** WhatsApp
- **Pay-in:** M-Pesa STK push
- **Payout:** BTC address

Do **not** build:
- all pairs
- USD routes
- full account system
- wallet dashboard
- card flows
- full WhatsApp bot
- real provider integrations if unavailable

Use mocks/adapters where needed, but keep architecture production-shaped.

---

## Product rules

- Guest conversion allowed without account creation
- Guest limits:
  - **100,000 KES daily**
  - **300,000 KES monthly**
- Persist guest details from first interaction
- Generate a unique **12-digit numeric `guest_ref`**
- Canonical dedupe identity is:
  - `country_code + document_type + document_number`
- Quote TTL = **30 seconds**
- Use explicit session states and persist all transitions
- Payment callbacks must be **idempotent**

---

## Required flow

1. User clicks CTA from landing page to `/convert` or `/guest-swap`
2. User enters KES amount
3. System returns KES → BTC quote
4. User confirms quote
5. Collect:
   - full name
   - country code
   - document type
   - document number
   - M-Pesa phone number
   - optional email
6. Run mock KYC / IPRS verification
7. Run mock AML screening
8. Enforce guest limits
9. Collect BTC address
10. Initiate mock/sandbox M-Pesa STK push
11. Move to payment pending state
12. Receive callback
13. Transition to payment confirmed
14. Run mock conversion execution
15. Run mock BTC delivery
16. Show success/failure status with references

---

## Required backend models

Add or extend models for:

### `guest_profiles`
Include:
- `guest_ref`
- `full_name`
- `country_code`
- `document_type`
- `document_number_normalized`
- `phone_e164`
- `email`
- `status`
- `risk_level`
- timestamps

### `conversion_sessions`
Include:
- `channel` (`WEB`, `WHATSAPP`)
- `guest_profile_id`
- `current_state`
- `status`
- `source_asset`
- `target_asset`
- `source_amount_minor`
- `quoted_target_amount_minor`
- `quote_id`
- `route_policy_key`
- `payin_method`
- `payout_method`
- `reference_code`
- `expires_at`
- `metadata_json`
- timestamps

### `conversion_quotes`
Include:
- source/target asset
- source/target amount
- rate
- spread
- fee
- status
- expires_at

### `payment_instructions`
Include:
- conversion_session_id
- provider `MPESA`
- instruction type `STK_PUSH`
- phone
- amount
- external reference
- provider ids
- status
- raw payload

### `payout_instructions`
Include:
- conversion_session_id
- destination type `BTC_ADDRESS`
- btc_address
- status

### `conversion_state_events`
Append-only audit trail for every state transition.

---

## Required states

Implement and enforce these states:

- `INTENT_CAPTURED`
- `QUOTE_PENDING`
- `QUOTE_READY`
- `QUOTE_CONFIRMED`
- `IDENTITY_PENDING`
- `COMPLIANCE_PENDING`
- `PAYOUT_DETAILS_PENDING`
- `PAYMENT_PENDING`
- `PAYMENT_CONFIRMED`
- `EXECUTION_PENDING`
- `DELIVERY_PENDING`
- `COMPLETED`
- `FAILED`
- `EXPIRED`
- `MANUAL_REVIEW`

Reject invalid transitions. Expired quotes must fail cleanly.

---

## Required backend responsibilities

### Conversion module
- route policy lookup
- quote generation
- session creation
- state transitions
- execution orchestration
- quote expiry validation

### Payments module
- M-Pesa adapter interface
- sandbox/mock STK push
- callback webhook
- idempotent callback handling

### KYC module
- guest identity validation
- mock IPRS verifier
- mock AML screening
- guest limit checks

### Risk module
- daily/monthly guest limits
- duplicate document detection
- velocity checks
- invalid transition guard

---

## Required API endpoints

Implement:

### `POST /api/guest-conversion/quote`
Input:
- `sourceAsset=KES`
- `targetAsset=BTC`
- `sourceAmount`
- `channel=WEB`

Returns:
- quote id
- target amount
- rate
- fee
- spread
- expiresAt

### `POST /api/guest-conversion/session`
Input:
- `quoteId`
- `channel=WEB`

Returns:
- session id
- current state

### `POST /api/guest-conversion/:sessionId/identity`
Input:
- full name
- country code
- document type
- document number
- phone
- optional email

Returns:
- `guestRef`
- current state
- compliance status

### `POST /api/guest-conversion/:sessionId/payout-details`
Input:
- `btcAddress`

### `POST /api/guest-conversion/:sessionId/initiate-payment`
Creates STK instruction and moves session to payment pending.

### `GET /api/guest-conversion/:sessionId/status`
Returns safe session status for UI polling.

### `POST /api/payments/mpesa/callback`
Handles callback idempotently and advances workflow.

---

## Provider abstractions

Use interfaces/adapters for:
- quote/rate provider
- IPRS verifier
- AML screening
- M-Pesa STK provider
- BTC delivery provider

Use mocks or sandbox implementations for now.

---

## Web requirements

Build a premium dark Koya conversion 

### Page flow
1. amount entry
2. quote review with 30s countdown
3. identity form
4. BTC address form
5. payment pending screen
6. processing / success / failure screen

### UI rules
- respect the design tokens and theme system in `@koya/design`

Wire the landing page CTA to this flow.

---

## Validation

Implement:
- KES amount validation
- guest daily/monthly limits
- Kenya phone normalization to E.164
- document normalization
- BTC address validation
- quote expiry checks
- state validation before every action

---

## Persistence and audit

Persist:
- quote creation
- session creation
- identity submission
- compliance result
- payout details
- payment initiation
- callback payloads
- execution start/result
- completion/failure

Every state transition must create a `conversion_state_events` record.

---

## Tests

Add:
- unit tests for quote calculation, expiry, guest ref generation, limits, phone normalization, BTC address validation, transition guard
- integration tests for full backend flow
- E2E test from landing page CTA through successful mock KES → BTC conversion

---

## Acceptance criteria

Done means:

- landing page CTA opens guest conversion flow
- user gets KES → BTC quote
- quote expires after 30 seconds
- user confirms quote and creates session
- user submits identity and gets `guest_ref`
- guest limits are enforced
- user submits BTC address
- system initiates mock M-Pesa payment
- callback advances session idempotently
- mock execution completes
- success/failure UI is shown
- all transitions are persisted
- backend design can later support WhatsApp without rewriting core workflow

---

## Output order

1. Prisma schema changes
2. backend domain types and route policy
3. NestJS services/controllers
4. mock provider adapters
5. web conversion page/components
6. landing page CTA wiring
7. tests
8. env vars
9. TODOs for real provider integration

Build it as a real fintech workflow, not a toy demo.
also update the progress in docs/progress accordingly.