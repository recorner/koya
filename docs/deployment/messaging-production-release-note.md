# Messaging Production Release Note

Date: 2026-04-20

## What was missing

- ECS API runtime task template did not inject required messaging env vars and WhatsApp/Telegram secrets.
- Task-definition rendering only resolved legacy secret ARNs, not messaging secret ARNs.
- Platform secret placeholders still contained Twilio entries and drifted from `infra/secrets-map.json`.
- Deploy flow used `force-new-deployment` without reliably registering fresh task definition revisions first.
- Terraform application task definition and WAF path references were stale relative to the messaging cutover routes.

## What was fixed

- Added full messaging runtime wiring to ECS API task template:
  - non-secret env vars for provider toggles/retries/provider config.
  - WhatsApp/Telegram secrets from Secrets Manager.
- Updated render pipeline to resolve messaging secret ARNs from `infra/secrets-map.json` and fail fast if unresolved.
- Aligned platform secret placeholders with canonical `infra/secrets-map.json`:
  - removed Twilio placeholders.
  - added WhatsApp/Telegram and web/payload placeholders.
- Updated deploy script to deterministic rollout order:
  1. render task definitions
  2. register migrate + API task definitions
  3. run migrate task on new migrate revision
  4. update service to new API revision
  5. verify `/api/v1/health`
- Updated CI deploy flows to call the same registration-first deploy path.
- Updated Terraform application ECS task definition with messaging runtime env/secrets.
- Updated WAF webhook path matching to current routes:
  - `/api/v1/messaging/webhooks/whatsapp-cloud`
  - `/api/v1/messaging/webhooks/telegram`

## Verified non-change

- Migrate task remains minimal (`NODE_ENV` + `DATABASE_URL`).
- Migration command remains `sh /app/scripts/migrate.sh` -> `prisma migrate deploy`.
- No messaging config is required for migrate-task startup.

## Operator actions still required

- Populate real (non-placeholder) values in Secrets Manager:
  - `/koya/whatsapp/appSecret`
  - `/koya/whatsapp/verifyToken`
  - `/koya/whatsapp/accessToken`
  - `/koya/telegram/botToken`
  - `/koya/telegram/webhookSecret`
- Ensure `WHATSAPP_PHONE_NUMBER_ID` in `env/production.env` is set to a real value.
- Perform provider-side webhook registration (not automated in repo):
  - WhatsApp callback/verify: `https://api.koyabank.com/api/v1/messaging/webhooks/whatsapp-cloud`
  - Telegram webhook: `https://api.koyabank.com/api/v1/messaging/webhooks/telegram` with matching `secret_token`
