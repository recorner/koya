# DFNS mTLS Setup & Operations Runbook

Owner: @recorner (primary)
Escalation: @recorner (PagerDuty, Slack #koya-ops)

## Overview

DFNS custody signing uses mutual TLS (mTLS) for production authentication. In sandbox/dev, API-key bearer auth is used as a fallback.

## Architecture

```
┌──────────┐    mTLS     ┌──────────┐
│ Koya API │ ──────────► │ DFNS API │
│          │  (cert+key) │          │
└──────────┘             └──────────┘
       │
       │ Circuit Breaker
       │ (Redis: koya:cb:psbt_signing)
       │
       ▼
  On failure flood (5 in 10min):
  → Circuit OPENS for 15min
  → CloudWatch alarm fires
  → SNS notifies @recorner
```

## AWS Secrets Manager Keys

| Secret Name | Description |
|---|---|
| `/koya/dfns/mTLS/cert` | Client certificate (PEM) |
| `/koya/dfns/mTLS/key` | Client private key (PEM) |
| `/koya/dfns/mTLS/ca` | Certificate Authority chain (PEM) |
| `/koya/dfns/apiKey` | DFNS sandbox API key (PAT) |
| `/koya/dfns/webhookSecret` | HMAC-SHA256 webhook verification secret |

## Environment Variables

```bash
# mTLS (production) — paths to PEM files
DFNS_MTLS_CERT=/run/secrets/dfns_mtls_cert
DFNS_MTLS_KEY=/run/secrets/dfns_mtls_key
DFNS_MTLS_CA=/run/secrets/dfns_mtls_ca

# API key (sandbox fallback)
DFNS_API_KEY=dfns-pat-...

# Common
DFNS_API_URL=https://api.dfns.ninja/v2
DFNS_APP_ID=ap-...
DFNS_WALLET_ID=wa-...
DFNS_WEBHOOK_SECRET=whsec-...
```

## Docker Compose (Staging Secrets)

```yaml
services:
  api:
    image: koyabank/api:staging
    secrets:
      - dfns_mtls_cert
      - dfns_mtls_key
      - dfns_mtls_ca
    environment:
      DFNS_MTLS_CERT: /run/secrets/dfns_mtls_cert
      DFNS_MTLS_KEY: /run/secrets/dfns_mtls_key
      DFNS_MTLS_CA: /run/secrets/dfns_mtls_ca
      DFNS_WEBHOOK_SECRET: ${DFNS_WEBHOOK_SECRET}

secrets:
  dfns_mtls_cert:
    external: true
  dfns_mtls_key:
    external: true
  dfns_mtls_ca:
    external: true
```

## ECS Task Definition (Production)

In AWS ECS, secrets are mounted from Secrets Manager:

```json
{
  "secrets": [
    {
      "name": "DFNS_MTLS_CERT_CONTENT",
      "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:/koya/dfns/mTLS/cert"
    },
    {
      "name": "DFNS_MTLS_KEY_CONTENT",
      "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:/koya/dfns/mTLS/key"
    },
    {
      "name": "DFNS_MTLS_CA_CONTENT",
      "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:/koya/dfns/mTLS/ca"
    }
  ]
}
```

A bootstrap entrypoint script writes these to files before the Node process starts:

```bash
#!/bin/bash
echo "$DFNS_MTLS_CERT_CONTENT" > /run/secrets/dfns_mtls_cert
echo "$DFNS_MTLS_KEY_CONTENT" > /run/secrets/dfns_mtls_key
echo "$DFNS_MTLS_CA_CONTENT" > /run/secrets/dfns_mtls_ca
chmod 600 /run/secrets/dfns_*
exec node dist/main.js
```

## Health Check

**Endpoint:** `GET /internal/health/dfns`

Validates:
- mTLS handshake (if configured): opens TLS socket with client cert, verifies server cert, timeout 2s
- API-key mode: lightweight GET to `/health` endpoint, timeout 2s

**Response:**
```json
{ "status": "ok", "latencyMs": 45, "mTls": true }
```

Wire this endpoint into your deployment orchestration health check.

## Certificate Rotation

### Automated (recommended)

```bash
# 1. Rotate certs in Secrets Manager + trigger ECS redeploy
./scripts/rotate-dfns-mtls.sh \
  --cert-file /path/to/new-cert.pem \
  --key-file /path/to/new-key.pem \
  --ca-file /path/to/ca.pem \
  --ecs-cluster koya-production \
  --ecs-service koya-api

# 2. Register the new certificate with DFNS (via dashboard or API)

# 3. Verify health
curl -sf https://api.koyabank.com/internal/health/dfns | jq .

# 4. Remove old certificate from DFNS after 24h grace period
```

### Manual

1. Generate new certificate pair from your CA
2. Upload to AWS Secrets Manager:
   ```bash
   aws secretsmanager put-secret-value --secret-id /koya/dfns/mTLS/cert --secret-string file://cert.pem
   aws secretsmanager put-secret-value --secret-id /koya/dfns/mTLS/key --secret-string file://key.pem
   aws secretsmanager put-secret-value --secret-id /koya/dfns/mTLS/ca --secret-string file://ca.pem
   ```
3. Register the new certificate with DFNS (via their dashboard or API)
4. Restart the Koya API service (rolling restart in ECS):
   ```bash
   aws ecs update-service --cluster koya-production --service koya-api --force-new-deployment
   ```
5. Verify: `GET /internal/health/dfns` returns `status: ok`
6. Remove old certificate from DFNS after 24h grace period

### Pre-deploy Cert Expiry Check

Run before any deployment:

```bash
./scripts/check-cert-expiry.sh --warn-days 14
```

This is also integrated into:
- The nightly CI workflow (warns if <14 days)
- Can be added as a CI gate to block deploys with expiring certs

## Circuit Breaker

The `PsbtSigningService` uses a Redis-backed circuit breaker to protect against cascading failures when DFNS is unavailable.

| Parameter | Value | Description |
|-----------|-------|-------------|
| Failure threshold | 5 | Max failures before opening |
| Failure window | 600s (10min) | Window to count failures |
| Open duration | 900s (15min) | How long circuit stays open |

### Redis Keys

| Key | Type | Description |
|-----|------|-------------|
| `koya:cb:psbt_signing:failures` | Sorted Set | Failure timestamps in window |
| `koya:cb:psbt_signing:open_until` | String | Epoch ms when circuit closes |

### States

- **Closed** — normal operation, requests flow through
- **Open** — all PSBT signing requests rejected with log error
- **Half-open** — allow one probe request; if it succeeds, close circuit

### Manual Reset

```bash
# Check circuit state
redis-cli GET koya:cb:psbt_signing:open_until

# Force close the circuit (emergency)
redis-cli DEL koya:cb:psbt_signing:open_until koya:cb:psbt_signing:failures
```

## Troubleshooting

### Health check fails

1. Check CloudWatch logs for `TLS handshake failed`
2. Verify certificate hasn't expired:
   ```bash
   ./scripts/check-cert-expiry.sh
   # Or manually:
   openssl x509 -in cert.pem -noout -dates
   ```
3. Verify cert+key match:
   ```bash
   openssl x509 -noout -modulus -in cert.pem | openssl md5
   openssl rsa -noout -modulus -in key.pem | openssl md5
   # Must match
   ```
4. Rotate certs if needed: `./scripts/rotate-dfns-mtls.sh ...`
5. Restart Koya API
6. Re-run health check

### Reconciliation alarm fires

1. Check the alarm in CloudWatch console → `Koya/Reconciliation` namespace
2. Fetch reconciliation logs:
   ```bash
   # CloudWatch Logs or server logs
   grep "ReconciliationService" /var/log/koya-api.log | tail -20
   ```
3. Query mismatched payouts:
   ```sql
   SELECT pi.id, pi.external_id, pi.amount_minor, pi.tx_hash, pi.status
   FROM payout_instructions pi
   WHERE pi.status = 'CONFIRMED'
   AND pi.updated_at > NOW() - INTERVAL '24 hours';
   ```
4. Cross-reference with Bria payouts:
   ```bash
   grpcurl -d '{"externalId":"<external_id>"}' localhost:2742 bria.v1.BriaService/GetPayout
   ```
5. Check for webhook dedup issues:
   ```sql
   SELECT * FROM processed_webhooks WHERE external_id = '<external_id>' ORDER BY created_at DESC;
   ```
6. Escalate to @recorner with:
   - Mismatch details (Koya amount vs Bria amount)
   - Whether transaction is on-chain (check mempool/explorer)
   - Whether this is a timing issue or actual fund discrepancy

### PSBT signing stuck in `signing_pending`

1. Check stuck PSBTs:
   ```sql
   SELECT * FROM payout_psbts
   WHERE psbt_status = 'signing_pending'
   AND updated_at < NOW() - INTERVAL '10 minutes';
   ```
2. Check circuit breaker state:
   ```bash
   redis-cli GET koya:cb:psbt_signing:open_until
   redis-cli ZCARD koya:cb:psbt_signing:failures
   ```
3. If circuit is open, wait for auto-close (15min) or force close:
   ```bash
   redis-cli DEL koya:cb:psbt_signing:open_until koya:cb:psbt_signing:failures
   ```
4. Check DFNS request status via dashboard: `GET /requests/{dfnsRequestId}`
5. If DFNS completed but webhook missed: manually trigger via DFNS webhook replay
6. If DFNS failed: check DFNS logs, potentially re-trigger signing

### Sign-latency CloudWatch alarm fires

1. Indicates PSBTs stuck in `signing_pending` > 10 minutes
2. Check circuit breaker state (see above)
3. Check DFNS health: `GET /internal/health/dfns`
4. Check network/mTLS connectivity to DFNS API
5. If DFNS is unreachable and circuit is open, this is expected behavior
6. Escalate if DFNS reports no issues but signing is still stuck

## On-Call Procedures

### Escalation Path

1. **L1 — Automated:** CloudWatch alarm → SNS → Slack #koya-ops / PagerDuty
2. **L2 — Engineer:** @recorner reviews CloudWatch logs, checks circuit breaker state
3. **L3 — Emergency:** If funds at risk (AbsDelta > 10000 sats), escalate to CTO immediately

### Daily Checks

- [ ] Reconciliation ran successfully (03:00 UTC) — check logs for `Reconciliation OK`
- [ ] PSBT retention ran (02:00 UTC) — check logs for `Archived N PSBTs`
- [ ] No PSBTs stuck in `signing_pending` > 1 hour
- [ ] DFNS health check passing: `GET /internal/health/dfns`
- [ ] Certificate expiry > 30 days: `./scripts/check-cert-expiry.sh --warn-days 30`

### Running the DFNS Integration Test Locally

```bash
# Full stack with DFNS mock
./scripts/run-integration.sh

# Or manually:
./scripts/run-dfns-mock.sh
docker compose up -d
pnpm nx test api --testPathPattern="integration"
```

## DFNS Simulation Commands

### Sign request (sandbox)
```bash
curl -H "Authorization: Bearer ${DFNS_API_KEY}" \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: koya:conversion:abc123" \
     -d '{"externalId":"koya:conversion:abc123","psbt":"<base64>","psbtId":"uuid-psbt","walletId":"dfns-wallet-1"}' \
     "${DFNS_API_URL}/v1/sign-psbt"
```

### Sign request (mTLS)
```bash
curl --cert /run/secrets/dfns_mtls_cert \
     --key /run/secrets/dfns_mtls_key \
     --cacert /run/secrets/dfns_mtls_ca \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: koya:conversion:abc123" \
     -d '{"externalId":"koya:conversion:abc123","psbt":"<base64>","psbtId":"uuid-psbt","walletId":"dfns-wallet-1"}' \
     "${DFNS_API_URL}/v1/sign-psbt"
```

### Webhook replay (test idempotency)
```bash
body='{"externalId":"koya:conversion:abc123","dfnsRequestId":"dfns-req-123","status":"COMPLETED","dfnsTxId":"txid..."}'
sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$DFNS_WEBHOOK_SECRET" -binary | openssl base64)
curl -H "Content-Type: application/json" \
     -H "X-DFNS-Signature: ${sig}" \
     -d "$body" \
     http://localhost:3333/api/v1/dfns/webhook
```

Re-run to validate dedup behavior (second call returns `already_processed`).
