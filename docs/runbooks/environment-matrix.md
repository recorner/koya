# Environment Matrix

**Last updated:** 2026-04-21  
**Release:** Euclide v1.1.001

---

## Release Identity

| Variable | Local | Staging | Production | Source |
|----------|-------|---------|------------|--------|
| `RELEASE_FAMILY` | `euclide` | `euclide` | `euclide` | ECS task def / env file |
| `RELEASE_VERSION` | `1.1.001` | `1.1.001` | `1.1.001` | ECS task def / env file |
| `NEXT_PUBLIC_APP_VERSION` | `1.1.001` | `1.1.001` | `1.1.001` | Vercel env / `.env.local` |
| `NEXT_PUBLIC_RELEASE_NAME` | `euclide` | `euclide` | `euclide` | Vercel env / `.env.local` |

---

## Web Environment Variables

| Variable | Local | Staging | Production | Source |
|----------|-------|---------|------------|--------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3333/api/v1` | `https://api.koyabank.com/api/v1` | `https://api.koyabank.com/api/v1` | Vercel env |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Preview URL | `https://koyabank.com` | Vercel env |
| `PAYLOAD_API_URL` | `http://localhost:3000/api` | `https://payload.koyabank.com/api` | `https://payload.koyabank.com/api` | Vercel env |
| `PAYLOAD_TIMEOUT_MS` | `5000` | `5000` | `5000` | Vercel env |
| `PAYLOAD_PREVIEW_USER_EMAIL` | local preview user | Secrets-backed | Secrets-backed | Vercel env |
| `PAYLOAD_PREVIEW_USER_PASSWORD` | local preview password | Secrets-backed | Secrets-backed | Vercel env |
| `KOYA_PREVIEW_SECRET` | local secret | Secrets-backed | Secrets-backed | Vercel env |
| `KOYA_REVALIDATE_WEBHOOK_SECRET` | local secret | Secrets-backed | Secrets-backed | Vercel env |
| `KOYA_REVALIDATE_MAX_SKEW_MS` | `300000` | `300000` | `300000` | Vercel env |

---

## API Environment Variables

| Variable | Local | Staging | Production | Source |
|----------|-------|---------|------------|--------|
| `NODE_ENV` | `development` | `production` | `production` | ECS task def |
| `PORT` | `3333` | `3333` | `3333` | ECS task def |
| `DATABASE_URL` | `.env.local` | Secrets Manager | Secrets Manager | Secret |
| `CORS_ORIGINS` | `http://localhost:3000` | Preview URL | `https://koyabank.com,https://www.koyabank.com` | ECS task def |
| `REDIS_HOST` | `localhost` | `redis.koyabank.com` | ElastiCache endpoint | ECS task def |
| `REDIS_PORT` | `6379` | `6379` | `6379` | ECS task def |
| `REDIS_PASSWORD` | _(empty)_ | Secrets Manager | Secrets Manager | Secret |
| `REDIS_TLS` | `false` | `false` | `true` | ECS task def |
| `REDIS_DB` | `0` | `0` | `0` | ECS task def |

### M-Pesa / Daraja

| Variable | Local | Staging | Production | Source |
|----------|-------|---------|------------|--------|
| `MPESA_DRIVER` | `mock` | `daraja` | `daraja` | ECS task def |
| `MPESA_ENVIRONMENT` | — | `sandbox` | `production` | ECS task def |
| `MPESA_CONSUMER_KEY` | mock | Secrets Manager | Secrets Manager | Secret |
| `MPESA_CONSUMER_SECRET` | mock | Secrets Manager | Secrets Manager | Secret |
| `MPESA_PASSKEY` | mock | Secrets Manager | Secrets Manager | Secret |
| `MPESA_SHORTCODE` | `174379` | `174379` | Real shortcode | ECS task def |
| `MPESA_CALLBACK_URL` | `http://localhost:3333/...` | `https://api.koyabank.com/api/v1/payments/mpesa/callback` | Same | ECS task def |

### BTC Delivery / Backends

| Variable | Local | Staging | Production | Source |
|----------|-------|---------|------------|--------|
| `BTC_DELIVERY_DRIVER` | `mock` | `dfns` | `bria` | ECS task def |
| `BTC_NETWORK` | `testnet4` | `testnet4` | `testnet4` or `bitcoin` (via mode) | ECS task def |
| `BTC_PRODUCTION_NETWORK_MODE` | `testnet4` | `testnet4` | `testnet4` or `mainnet` | ECS task def |
| `BTC_PAYOUT_RETRY_MAX_ATTEMPTS` | `5` | `5` | `5` | ECS task def |
| `BTC_PAYOUT_RETRY_POLL_MS` | `5000` | `5000` | `5000` | ECS task def |
| `DFNS_API_URL` | — | `https://api.dfns.ninja/v2` | `https://api.dfns.io` | ECS task def |
| `DFNS_APP_ID` | — | App ID | App ID | ECS task def |
| `DFNS_WALLET_ID` | — | Wallet ID | Wallet ID | ECS task def |
| `DFNS_API_KEY` | — | Secrets Manager | — (mTLS only) | Secret |
| `DFNS_MTLS_CERT` | — | `/run/secrets/dfns_cert` | `/run/secrets/dfns_cert` | File mount |
| `DFNS_MTLS_KEY` | — | `/run/secrets/dfns_key` | `/run/secrets/dfns_key` | File mount |
| `DFNS_MTLS_CA` | — | `/run/secrets/dfns_ca` | `/run/secrets/dfns_ca` | File mount |
| `DFNS_WEBHOOK_SECRET` | — | Secrets Manager | Secrets Manager | Secret |
| `DFNS_WEBHOOK_URL` | — | `https://api.koyabank.com/api/v1/dfns/webhook` | Same | ECS task def |

### Bria

| Variable | Local | Staging | Production | Source |
|----------|-------|---------|------------|--------|
| `BRIA_API_HOST` | `localhost` | Bria host | Bria host | ECS task def |
| `BRIA_API_PORT` | `2742` | `2742` | `2742` | ECS task def |
| `BRIA_NETWORK` | `testnet` | `testnet` | `testnet` or `bitcoin` (derived) | ECS task def |
| `BRIA_API_KEY` | local key | Secrets Manager | Secrets Manager | Secret |
| `BRIA_ADMIN_HOST` | `localhost` | Bria host | Bria host | ECS task def |
| `BRIA_ADMIN_PORT` | `2743` | `2743` | `2743` | ECS task def |
| `BRIA_ADMIN_API_KEY` | local key | Same as API key | Same as API key | Secret |
| `BRIA_WALLET_NAME` | `koya-testnet` | `koya-testnet` | `koya-mainnet` | ECS task def |
| `BRIA_PAYOUT_QUEUE_NAME` | `koya-payouts` | `koya-payouts` | `koya-payouts` | ECS task def |
| `BRIA_XPUB_REF` | local ref | xpub ref | xpub ref | ECS task def |
| `BRIA_TIMEOUT_MS` | `5000` | `5000` | `5000` | ECS task def |
| `BRIA_MAX_RETRIES` | `3` | `3` | `3` | ECS task def |

### Rates

| Variable | Local | Staging | Production | Source |
|----------|-------|---------|------------|--------|
| `BINANCE_API_URL` | `https://api.binance.com` | Same | Same | ECS task def |
| `KRAKEN_API_URL` | `https://api.kraken.com` | Same | Same | ECS task def |
| `FX_API_URL` | mock | Real API | Real API | ECS task def |
| `FX_API_KEY` | mock | Secrets Manager | Secrets Manager | Secret |

### Messaging Providers (WhatsApp Cloud + Telegram)

| Variable | Local | Staging | Production | Source |
|----------|-------|---------|------------|--------|
| `MESSAGING_ENABLE_WHATSAPP_CLOUD` | `true` | `true` | `true` | ECS task def |
| `MESSAGING_ENABLE_TELEGRAM` | `true` | `true` | `true` | ECS task def |
| `WHATSAPP_APP_SECRET` | local secret | Secrets Manager | Secrets Manager | Secret |
| `WHATSAPP_VERIFY_TOKEN` | local token | Secrets Manager | Secrets Manager | Secret |
| `WHATSAPP_ACCESS_TOKEN` | local token | Secrets Manager | Secrets Manager | Secret |
| `WHATSAPP_PHONE_NUMBER_ID` | local id | Meta phone id | Meta phone id | ECS task def |
| `WHATSAPP_SESSION_TTL_MINUTES` | `10` | `10` | `10` | ECS task def |
| `WHATSAPP_RATE_LIMIT_PER_MINUTE` | `20` | `20` | `20` | ECS task def |
| `WHATSAPP_WEB_BASE_URL` | `http://localhost:3000` | Preview URL | `https://koyabank.com` | ECS task def |
| `TELEGRAM_BOT_TOKEN` | local token | Secrets Manager | Secrets Manager | Secret |
| `TELEGRAM_WEBHOOK_SECRET` | local token | Secrets Manager | Secrets Manager | Secret |
| `TELEGRAM_ALLOWED_IPS` | empty | optional allowlist | optional allowlist | ECS task def |

### Ops / AWS

| Variable | Local | Staging | Production | Source |
|----------|-------|---------|------------|--------|
| `PSBT_ARCHIVE_S3_BUCKET` | — | `koya-archives-staging` | `koya-archives-prod` | ECS task def |
| `PSBT_ARCHIVE_KMS_KEY_ID` | — | KMS key ID | KMS key ID | ECS task def |
| `AWS_REGION` | — | `us-east-1` | `us-east-1` | ECS task def |
| `CLOUDWATCH_METRICS_ENABLED` | `false` | `true` | `true` | ECS task def |

### Security / Hardening

| Variable | Local | Staging | Production | Source |
|----------|-------|---------|------------|--------|
| `TRUST_PROXY_HOPS` | `0` | `1` | `1` | ECS task def |
| `JSON_BODY_LIMIT` | `100kb` | `100kb` | `100kb` | ECS task def |
| `URLENCODED_BODY_LIMIT` | `100kb` | `100kb` | `100kb` | ECS task def |
| `THROTTLE_DEFAULT_LIMIT` | `1000` | `60` | `60` | ECS task def |
| `THROTTLE_DEFAULT_TTL_SECONDS` | `60` | `60` | `60` | ECS task def |

---

## Bria Environment Variables

| Variable | Local | Staging | Production | Source |
|----------|-------|---------|------------|--------|
| `PG_CON` | `postgres://bria:bria_dev_password@bria-pg:5432/bria` | Secrets Manager | Secrets Manager | Secret |
| `SIGNER_ENCRYPTION_KEY` | `openssl rand -hex 32` | Secrets Manager | Secrets Manager | Secret |
| `BRIA_HOME` | `/bria` | `/bria` | `/bria` | Config |
| `BRIA_CONFIG` | `/etc/bria/bria.yml` | Same | Same | Config |
| `RUST_LOG` | `debug` | `info` | `info` | Config |

### Bria Config (`config/bria.yml`)

| Setting | Local/Staging | Production |
|---------|--------------|------------|
| `app.blockchain.network` | `testnet` (for testnet4 policy) | `testnet` or `bitcoin` by production mode |
| `app.blockchain.electrum_url` | `mempool.space:40002` | Production Electrum |
| `api.listen_port` | `2742` | `2742` |
| `admin.listen_port` | `2743` | `2743` |
| `db.pool_size` | `20` | `50` |
| `app.jobs.signing.max_attempts` | `5` | `5` |

---

## AWS Secrets Manager Index

| Secret Path | Consumer | Description |
|-------------|----------|-------------|
| `/koya/api/DATABASE_URL` | API (ECS) | PostgreSQL connection string |
| `/koya/api/REDIS_URL` | API (ECS) | Redis connection URL |
| `/koya/api/REDIS_PASSWORD` | API (ECS) | Redis password |
| `/koya/api/FX_API_KEY` | API (ECS) | FX rate provider API key |
| `/koya/api/SLACK_WEBHOOK_URL` | API (ECS) | Slack operational alerts |
| `/koya/daraja/consumerKey` | API (ECS) | Safaricom Daraja key |
| `/koya/daraja/consumerSecret` | API (ECS) | Safaricom Daraja secret |
| `/koya/daraja/passkey` | API (ECS) | Safaricom LipaNaMpesa passkey |
| `/koya/dfns/apiKey` | API (ECS), Nightly CI | DFNS API key |
| `/koya/dfns/mTLS/cert` | API (ECS), Nightly CI | DFNS mTLS client certificate |
| `/koya/dfns/mTLS/key` | API (ECS), Nightly CI | DFNS mTLS client private key |
| `/koya/dfns/mTLS/ca` | API (ECS), Nightly CI | DFNS mTLS CA certificate |
| `/koya/dfns/webhookSecret` | API (ECS), Nightly CI | DFNS webhook HMAC secret |
| `/koya/bria/signerEncryptionKey` | Bria | Signer encryption key (32-byte hex) |
| `/koya/bria/pgConnection` | Bria | Bria PostgreSQL connection string |
| `/koya/bria/apiKey` | API (ECS), Bria | Bria gRPC API key |
| `/koya/whatsapp/appSecret` | API (ECS) | Meta WhatsApp app secret |
| `/koya/whatsapp/verifyToken` | API (ECS) | Meta WhatsApp verify token |
| `/koya/whatsapp/accessToken` | API (ECS) | Meta WhatsApp Cloud API token |
| `/koya/telegram/botToken` | API (ECS) | Telegram bot token |
| `/koya/telegram/webhookSecret` | API (ECS) | Telegram webhook secret token |
| `/koya/payload/previewUserEmail` | Web (Vercel) | Payload preview service account email |
| `/koya/payload/previewUserPassword` | Web (Vercel) | Payload preview service account password |
| `/koya/web/previewSecret` | Web (Vercel) | Preview endpoint secret (`/api/preview`) |
| `/koya/web/revalidateWebhookSecret` | Web (Vercel) | Signed revalidation webhook HMAC secret (`/api/revalidate`) |

---

## GitHub Repository Secrets

| Secret | Used By | Description |
|--------|---------|-------------|
| `VERCEL_TOKEN` | CI: deploy-preview, deploy-production | Vercel deployment token |
| `VERCEL_ORG_ID` | CI: deploy-preview, deploy-production | Vercel team/org ID |
| `VERCEL_PROJECT_ID` | CI: deploy-preview, deploy-production | Vercel project ID |
| `AWS_ROLE_ARN` | Nightly CI, deploy-api | `arn:aws:iam::286119371044:role/github-actions-deploy` |

---

## Environment Files

### Config Source of Truth

Non-secret configuration now lives in environment files:
- `env/staging.env` — Staging config
- `env/production.env` — Production config
- `env/integration.env` — Local development config

These files feed into:
- Terraform variables (via `scripts/bootstrap-aws.sh`)
- Task definition rendering (via `scripts/render-task-definitions.sh`)
- Deploy scripts (via `scripts/load-env.sh`)

Secrets continue to live in AWS Secrets Manager. See `infra/secrets-map.json` for the mapping.
