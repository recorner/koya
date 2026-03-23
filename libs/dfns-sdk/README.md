# @koya/dfns-sdk

TypeScript SDK for DFNS PSBT signing with mTLS support.

## Features

- **PSBT Signing** — `requestSignPsbt()` sends unsigned PSBTs to DFNS for signing
- **mTLS** — Client certificate authentication for staging/production
- **API Key Fallback** — Bearer token auth for sandbox environments
- **Idempotency** — `Idempotency-Key` header prevents duplicate signing
- **Retry** — Exponential backoff + jitter for transient errors (5xx, 429)
- **Webhook Verification** — HMAC-SHA256 signature verification for DFNS callbacks

## Usage

```typescript
import { DFNSClient } from '@koya/dfns-sdk';

const client = new DFNSClient({
  baseUrl: 'https://api.dfns.ninja/v2',
  appId: process.env.DFNS_APP_ID,
  walletId: process.env.DFNS_WALLET_ID,
  apiKey: process.env.DFNS_API_KEY, // sandbox fallback
  mTlsOptions: {
    cert: fs.readFileSync('/path/to/client.crt'),
    key: fs.readFileSync('/path/to/client.key'),
    ca: fs.readFileSync('/path/to/ca.crt'),
  },
});

// Sign a PSBT
const result = await client.requestSignPsbt({
  externalId: 'koya:conversion:abc123',
  psbtBase64: unsignedPsbtBase64,
  psbtId: briaBatchId,
});

// result.signedPsbtBase64 — signed PSBT ready for Bria broadcast
```

## mTLS Configuration

mTLS is **required** in staging and production. In sandbox, the SDK falls back to API key authentication.

| Environment | Auth Method |
|------------|-------------|
| Sandbox | `Authorization: Bearer <DFNS_API_KEY>` |
| Staging | mTLS client cert + key |
| Production | mTLS client cert + key |

See `docs/deployment/dfns-sdk.md` for cert provisioning instructions.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DFNS_API_URL` | DFNS API base URL | Yes |
| `DFNS_APP_ID` | DFNS application ID | Yes |
| `DFNS_WALLET_ID` | DFNS wallet ID | Yes |
| `DFNS_API_KEY` | API key (sandbox) | Sandbox only |
| `DFNS_WEBHOOK_SECRET` | HMAC secret for webhooks | Yes |
