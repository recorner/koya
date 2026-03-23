Goal: Implement a TypeScript libs/dfns-sdk and wire Koya so Bria builds PSBTs and DFNS signs them. Koya stores PSBT metadata (payout_psbts) in the DB and coordinates: Bria → Koya → DFNS → Koya → Bria broadcast. Use mTLS as required in staging/prod and API-key/HMAC fallback for sandbox. Follow Koya conventions (Nx/pnpm/NestJS/Prisma).

0) Read first (mandatory)

Before coding, read these files to understand current design, lessons, and existing Bria adapter:

docs/progress/step-13.md (Bria + DFNS + Daraja integration summary)
tasks/lessons.md (repo lessons)
tasks/todo.md (project TODOs)
libs/bria-adapter/ (the Bria adapter you implemented in Step 11)
apps/api/src/conversion/*, apps/api/src/providers/* and apps/api/prisma/schema.prisma (to see existing payout & delivery code)

Acceptance: In the PR description include a one-paragraph summary of what you learned from those files and how your changes align.

1) Overview of the chosen flow (Bria-initiated signing)
Bria builds an unsigned PSBT using its UTXO selection: BriaClientService.createPayoutPSBT(...) returns { psbtId, psbtBase64 }.
Koya API stores PSBT metadata under payout_psbts in Koya DB keyed by externalId.
Koya calls DFNS SDK requestSignPsbt({ externalId, psbtBase64, psbtId, walletId, metadata }) (mTLS to DFNS).
DFNS signs PSBT, returns { dfnsRequestId, signedPsbtBase64, signerMeta } or 409 ALREADY_EXISTS with same payload.
Koya verifies signer metadata (HMAC + signer metadata or verify mTLS cert), stores signedPsbt, persists dfnsRequestId.
Koya calls BriaClientService.submitSignedPsbt(psbtId, signedPsbtBase64) to broadcast.
Bria broadcasts, manages confirmations, emits payout_broadcast and payout_settled. Event consumer updates Koya state to COMPLETED.
2) Implement libs/dfns-sdk (TypeScript; location: libs/dfns-sdk/)
Files & structure
libs/dfns-sdk/
├─ package.json
├─ README.md
├─ src/
│  ├─ index.ts                  # exports
│  ├─ dfns.client.ts            # DFNSClient class
│  ├─ dfns.types.ts             # DTOs & types
│  ├─ dfns.errors.ts            # DfnsTransientError, DfnsPermanentError
│  ├─ dfns.retry.ts             # retry/backoff helper
│  ├─ dfns.signature.ts         # HMAC verify + utils
│  └─ __tests__/
│     ├─ dfns.client.spec.ts
│     ├─ dfns.signature.spec.ts
│     └─ dfns.retry.spec.ts
DFNSClient API (implement)
// constructor opts
new DFNSClient({ baseUrl, appId, walletId, apiKey?, mTlsOptions?: { cert, key, ca }, maxRetries = 5, timeoutMs = 15000, logger? })

async requestSignPsbt(params: {
  externalId: string,
  psbtBase64: string,
  psbtId?: string,
  walletId?: string,
  metadata?: Record<string, any>
}): Promise<{
  dfnsRequestId: string,
  signedPsbtBase64: string,
  signerMeta: { signerId: string, timestamp: string }
  alreadyExists?: boolean
}>

async getRequestStatus(dfnsRequestId: string): Promise<{ status: string, dfnsTxId?: string, raw: any }>

verifyWebhookSignature(rawBody: Buffer|string, signatureHeader: string, secret?: string): boolean

parseAndVerifyWebhook(rawBody: Buffer|string, signatureHeader: string, secret?: string): { externalId: string, dfnsRequestId?: string, status: string, dfnsTxId?: string, raw: any }
Behavior & requirements
mTLS required in staging/prod: the client must support TLS client cert/key and server CA. The SDK should support mTLS via mTlsOptions and fallback to API-key header for sandbox if mTlsOptions not provided. Document that mTLS is required for production.
Idempotency: include Idempotency-Key: externalId header in signing requests. If DFNS returns 409, treat as success and return existing signed PSBT payload when available.
Retries: handle transient errors (5xx, 429, network timeouts) with exponential backoff + jitter. Make maxRetries configurable (default 5, baseDelayMs = 500).
Signature verification: verify webhook HMAC-SHA256 in dfns.signature.ts using constant-time comparison. Also provide a utility to validate signing responses if DFNS returns a response signature.
Errors: throw DfnsTransientError for retryable and DfnsPermanentError for non-retryable. Include useful diagnostics.
Tests: unit tests must cover success path, 409 idempotent path, retries, signature verification.

Acceptance: pnpm nx test dfns-sdk passes locally.

3) DB migration — Koya stores PSBT metadata
Prisma migration (create file under apps/api/prisma/migrations/…)

Add payout_psbts model (example Prisma schema snippet):

model PayoutPsbt {
  id                 String   @id @default(uuid())
  externalId         String   @unique
  psbtBase64         String
  psbtStatus         String   @default("unsigned") // unsigned | signing_pending | signed | broadcast | settled | failed
  psbtId             String?  // optional: bria psbt id if provided
  dfnsRequestId      String? 
  signedPsbtBase64   String? 
  txid               String? 
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}

Also ensure PayoutInstruction.externalId exists (Step 12/13 added), and dfns_requests table exists (Step 13). If not, add them.

Acceptance: prisma migrate deploy runs locally and the tables appear.

4) API changes — Koya integration (files to add/modify)
a) Bria → Koya PSBT flow
No change to Bria: Bria already has createPayoutPSBT and submitSignedPsbt in libs/bria-adapter. Verify those methods exist. If not implement BriaClientService.createPayoutPSBT({ externalId, outputs, feePolicy }) returning { psbtId, psbtBase64 }.
Koya flow (new) in apps/api/src/conversion (or provider):
ConversionService calls briaClient.createPayoutPSBT({ externalId, outputs }).
Persist PayoutPsbt record with psbtId and psbtBase64, status signing_pending.
Call dfnsClient.requestSignPsbt({ externalId, psbtBase64, psbtId, walletId, metadata }).
On DFNS response with signedPsbt, verify signature via SDK helper or via DFNS response evidence; update PayoutPsbt with signedPsbtBase64, dfnsRequestId, status signed.
Call briaClient.submitSignedPsbt(psbtId, signedPsbtBase64) and record txid on success (update psbtStatus=broadcast, txid).
Let BriaEventConsumerService handle confirmations (payout_settled) and convert to COMPLETED.
b) DfnsBtcDeliveryProvider
Replace DFNS HTTP logic with SDK usage. Provider should:
use DFNSClient.requestSignPsbt(...)
handle alreadyExists by retrieving signed PSBT (SDK returns it) and proceed
persist dfns_requests if not already present
c) DfnsController webhook
Verify DFNS webhooks via DFNSClient.parseAndVerifyWebhook(...).
Use processed_webhooks table (INSERT ... ON CONFLICT DO NOTHING) to dedupe.
Inside SERIALIZABLE transaction: update dfns_requests, update related PayoutPsbt (signed_psbt or txid if DFNS pushes txid), and trigger BriaClientService.submitSignedPsbt if needed.
5) Security: mTLS & HMAC
mTLS required in staging/prod: SDK must accept mTlsOptions = { cert, key, ca } and use them for requests. Document how to provision and mount certs (Secrets Manager + volume) in runbook.
Sandbox fallback: if no mTLS options present, SDK should use DFNS_API_KEY in Authorization: Bearer header and include Idempotency-Key.
Webhook verification: use DFNS_WEBHOOK_SECRET with HMAC-SHA256 to verify DFNS webhooks if DFNS uses HMAC. If DFNS uses client mTLS callbacks, verify the client cert. Implement both and prefer mTLS verification in staging/prod.
6) Tests & integration simulation
Unit tests
libs/dfns-sdk unit tests (client, retry, signature)
apps/api unit tests for the new Koya flow: a) createPayoutPSBT flow, b) DFNS signed response handling, c) duplicate DFNS responses are idempotent.
Integration simulation (local)
You have DFNS sandbox; for CI/local include a lightweight DFNS mock that:
accepts POST /v1/sign-psbt, returns signed PSBT (simulate signing with a dummy signer that actually signs the PSBT using a test key) OR returns 409 if the same Idempotency-Key is seen.
Sends signed webhook POST /api/v1/dfns/webhook signed with DFNS_WEBHOOK_SECRET.
Steps:
Start koya-api, redis, bria-pg, bria (Bria running), QuickNode testnet, and DFNS sandbox/mock.
Create a conversion in Koya that triggers createPayoutPSBT -> Koya persists PSBT -> calls DFNS -> DFNS returns signed PSBT -> Koya calls submitSignedPsbt -> Bria broadcasts -> confirm via event.
Repeat the DFNS sign request (duplicate) and the DFNS webhook duplication — verify idempotency.
7) Acceptance criteria
libs/dfns-sdk implemented and unit tested.
apps/api persists PayoutPsbt metadata and uses DFNS SDK for signing.
Signed PSBTs are verified and submitted to Bria via submitSignedPsbt.
Duplicate DFNS responses produce no duplicate ledger modifications.
mTLS is enforced in staging, SDK supports mTLS and API-key fallback.
Integration simulation (DFNS sandbox/mock) demonstrates successful end-to-end signed PSBT flow and conversion COMPLETE.
Documentation updated: docs/deployment/dfns-sdk.md with mTLS setup, env vars, and run instructions.
8) Example headers & JSON (for engineer convenience)

Sign request (Koya → DFNS)
Headers:

Authorization: Bearer <DFNS_API_KEY>   # fallback
Idempotency-Key: koya:conversion:<refCode>
X-DFNS-App: <DFNS_APP_ID>

Body:

{
  "externalId": "koya:conversion:abc123",
  "psbt": "<base64>",
  "psbtId": "uuid-psbt",
  "walletId": "<dfns-wallet-id>",
  "metadata": { "conversionRef": "abc123", "requestedBy":"koya" }
}

Signed response (DFNS → Koya) (200)

{
  "dfnsRequestId": "dfns-req-123",
  "signedPsbt": "<base64>",
  "signerMeta": { "signerId": "dfns-01", "timestamp": "2026-03-..." }
}

409 ALREADY_EXISTS (body could include existing signed PSBT)

{
  "error": "ALREADY_EXISTS",
  "dfnsRequestId": "dfns-req-existing",
  "signedPsbt": "<base64>"
}

DFNS webhook (signed)
Headers: X-DFNS-Signature: <hmac> or client cert validated.
Body:

{ "externalId": "koya:conversion:abc123", "dfnsRequestId":"dfns-req-123", "status":"COMPLETED", "dfnsTxId":"txid..." }
9) Run & debug commands
Generate & run migrations: pnpm nx prisma migrate dev --name add_payout_psbts
Run unit tests: pnpm nx test dfns-sdk and pnpm nx test api
Start local stack: docker compose up -d bria bria-pg redis api and DFNS sandbox/mock.
Run a conversion via API or UI and watch logs of koya-api and koya-bria.
10) Deliverables & PR checklist
libs/dfns-sdk with tests + README (mTLS & sandbox config)
Prisma migration for payout_psbts (and verify dfns_requests existence)
apps/api changes (Conversion flow, DfnsBtcDeliveryProvider, DfnsController webhook) using DFNSClient
Unit & integration tests + simulation instructions
Updated docs/deployment/ with mTLS setup & secrets steps
PR description summarizing design decisions and how it reads Step 13