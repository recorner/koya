# Messaging Cutover Implementation Note

## Current Flow (Before)
- Website conversion entry points are `/` (guest swap teaser) and `/convert` (full wizard).
- Core conversion business flow stays in `guest-conversion/*` API endpoints and `ConversionService` state transitions.
- Chat conversion was WhatsApp-only and Twilio-coupled:
  - Twilio-form webhook input at `POST /api/v1/whatsapp/webhook`
  - Twilio adapter-driven outbound sends
  - Twilio SID-based idempotency in `whatsapp_message_events`
- Tracking status already exists at `/convert?ref=<referenceCode>` backed by `GET /guest-conversion/by-reference/:referenceCode/status`.

## Existing Architecture (Baseline)
- Conversion and payment side effects are event-driven (`payment.confirmed`, `delivery.confirmed`, `conversion.completed`).
- WhatsApp conversational state is stored in `whatsapp_conversations` + `whatsapp_message_events`.
- Idempotency existed but was provider-specific and Twilio-shaped.

## Preserved Behavior
- Conversion business-state machine and side effects in `ConversionService` are preserved.
- Web UX/layout and conversion wizard flow are preserved.
- Reference-code tracking links remain `/convert?ref=<referenceCode>`.

## Replaced Components
- Removed Twilio dependency and Twilio adapter runtime path.
- Added provider-neutral messaging subsystem:
  - `MessagingOrchestratorService`
  - `MessagingProviderRouter`
  - Provider contracts (`MessagingProvider`, verifier/normalizer/template sender)
  - `WhatsAppCloudProvider` and `TelegramProvider`
- Added authenticated webhook endpoints:
  - `GET/POST /api/v1/messaging/webhooks/whatsapp-cloud`
  - `POST /api/v1/messaging/webhooks/telegram`
- Added provider-neutral persistence for inbound events, delivery attempts, retries, dead letters, and audit records.

## Migration Risk Points
- Existing data compatibility for renamed message-id column (`twilio_message_sid` -> `provider_message_id`).
- Provider secret/config completeness must be validated before production deploy.
- Retry/DLQ worker tuning (`MESSAGING_MAX_RETRIES`, `MESSAGING_RETRY_BASE_MS`) impacts message latency vs. fail-fast behavior.
- Telegram participant identifiers are non-phone; flow still requests Kenyan M-Pesa number where required.

## Rollout
- Deploy DB migration `20260420110000_messaging_orchestration_cutover` first.
- Configure and validate required secrets:
  - `MESSAGING_ENABLE_WHATSAPP_CLOUD=true`
  - `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
  - `MESSAGING_ENABLE_TELEGRAM=true`
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
  - `WHATSAPP_WEB_BASE_URL`
- Switch webhook registrations to:
  - WhatsApp Cloud: `GET/POST /api/v1/messaging/webhooks/whatsapp-cloud`
  - Telegram: `POST /api/v1/messaging/webhooks/telegram`
- Monitor: signature failures, duplicate-event counts, retry growth, dead-letter growth, and tracking-link dispatch success.

## Rollback
- Disable chat ingress quickly with feature toggles:
  - `MESSAGING_ENABLE_WHATSAPP_CLOUD=false`
  - `MESSAGING_ENABLE_TELEGRAM=false`
- Keep web conversion flow active (`/convert`) while chat ingress is paused.
- Investigate/replay dead-lettered events after mitigation.
- Do not roll back the schema rename (`provider_message_id`) once applied; keep forward schema and redeploy fixed application code.
