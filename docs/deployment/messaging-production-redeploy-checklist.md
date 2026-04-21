# Messaging Production Redeploy Checklist

Last updated: 2026-04-21

Use this checklist before redeploying the API to `api.koyabank.com`.

## 1. Infra and runtime wiring

- [ ] `infra/templates/ecs-task-definition.tpl.json` includes messaging non-secret env vars:
  - `MESSAGING_ENABLE_WHATSAPP_CLOUD`
  - `MESSAGING_ENABLE_TELEGRAM`
  - `MESSAGING_MAX_RETRIES`
  - `MESSAGING_RETRY_BASE_MS`
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_CLOUD_API_VERSION`
  - `WHATSAPP_WEB_BASE_URL`
  - `TELEGRAM_ALLOWED_IPS`
- [ ] `infra/templates/ecs-task-definition.tpl.json` includes messaging secrets:
  - `WHATSAPP_APP_SECRET`
  - `WHATSAPP_VERIFY_TOKEN`
  - `WHATSAPP_ACCESS_TOKEN`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_WEBHOOK_SECRET`
- [ ] `scripts/render-task-definitions.sh` resolves all required messaging secret ARNs from `infra/secrets-map.json`.
- [ ] `terraform/aws/platform/secrets.tf` has no Twilio placeholders and includes WhatsApp + Telegram placeholders.
- [ ] `infra/secrets-map.json`, Terraform secret placeholders, and render logic are aligned.

## 2. Production config and secrets

- [ ] `env/production.env` has intentional messaging values:
  - `MESSAGING_ENABLE_WHATSAPP_CLOUD=true`
  - `MESSAGING_ENABLE_TELEGRAM=true`
  - `MESSAGING_MAX_RETRIES` and `MESSAGING_RETRY_BASE_MS`
  - `WHATSAPP_PHONE_NUMBER_ID` (real value, not placeholder)
  - `WHATSAPP_CLOUD_API_VERSION=v21.0` (or intentional override)
  - `TELEGRAM_ALLOWED_IPS` (intentional, may be empty)
  - `WHATSAPP_WEB_BASE_URL=https://koyabank.com`
- [ ] Required Secrets Manager entries exist and are not placeholders:
  - `/koya/whatsapp/appSecret`
  - `/koya/whatsapp/verifyToken`
  - `/koya/whatsapp/accessToken`
  - `/koya/telegram/botToken`
  - `/koya/telegram/webhookSecret`

## 3. Render, register, migrate, rollout

- [ ] Rendered task definitions are generated for the release image tag.
- [ ] New ECS task definition revisions are registered for both API and migrate tasks.
- [ ] Migrate task runs on the newly-registered migrate revision and exits with code `0`.
- [ ] API service is updated to the newly-registered API revision.
- [ ] `https://api.koyabank.com/api/v1/health` returns HTTP `200`.

Recommended deploy commands:

```bash
# Optional: build and push image from this machine
./scripts/deploy-api.sh production <image-tag> --build

# If image is already pushed:
./scripts/deploy-api.sh production <image-tag>
```

## 4. Provider webhook hookup (manual)

Webhook registration is not automated in this repo.

### WhatsApp Cloud

- [ ] In Meta App Dashboard, set callback URL to:
  - `https://api.koyabank.com/api/v1/messaging/webhooks/whatsapp-cloud`
- [ ] Set verify token to the value from Secrets Manager path:
  - `/koya/whatsapp/verifyToken`
- [ ] Complete provider-side verification challenge successfully.
- [ ] Verify challenge endpoint using:
  - `./scripts/verify-whatsapp-webhook.sh production`

### Telegram

- [ ] Register webhook to:
  - `https://api.koyabank.com/api/v1/messaging/webhooks/telegram`
- [ ] Use `secret_token` equal to `/koya/telegram/webhookSecret`.

Example registration command:

```bash
curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://api.koyabank.com/api/v1/messaging/webhooks/telegram" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

Verify command:

```bash
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Automated registration command:

```bash
./scripts/register-telegram-webhook.sh production
```

## 5. Post-deploy smoke tests

- [ ] WhatsApp webhook verification succeeds.
- [ ] Telegram webhook secret verification succeeds (valid accepted, invalid rejected).
- [ ] Inbound WhatsApp webhook accepted.
- [ ] Inbound Telegram webhook accepted.
- [ ] Outbound WhatsApp send succeeds.
- [ ] Outbound Telegram send succeeds.
- [ ] Provider API outbound smoke succeeds:
  - `./scripts/messaging-smoke.sh production --whatsapp-recipient <E164> --telegram-chat-id <chat-id>`
- [ ] Chat conversion reaches terminal state.
- [ ] Tracking link is sent at completion.
- [ ] CloudWatch logs show no startup/config failures.
- [ ] No immediate retry storm or DLQ spike after rollout.
