/**
 * DFNS Mock Server — for local integration testing
 *
 * Endpoints:
 *   POST /v1/sign-psbt     — mock signing (returns modified PSBT, idempotent)
 *   GET  /health            — health probe
 *   POST /v1/webhook/test   — trigger a webhook callback to a target
 *
 * Usage:
 *   node scripts/dfns-mock/server.js [--port 4444] [--webhook-target http://localhost:3333/api/v1/dfns/webhook]
 *
 * Environment:
 *   DFNS_MOCK_PORT=4444
 *   DFNS_MOCK_WEBHOOK_TARGET=http://localhost:3333/api/v1/dfns/webhook
 *   DFNS_MOCK_WEBHOOK_SECRET=test-webhook-secret
 */

import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';

const PORT = parseInt(process.env.DFNS_MOCK_PORT || '4444', 10);
const WEBHOOK_TARGET = process.env.DFNS_MOCK_WEBHOOK_TARGET || 'http://localhost:3333/api/v1/dfns/webhook';
const WEBHOOK_SECRET = process.env.DFNS_MOCK_WEBHOOK_SECRET || 'test-webhook-secret';

// In-memory idempotency store
const processedRequests = new Map();

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function respond(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handleSignPsbt(req, res) {
  const body = await parseBody(req);
  const idempotencyKey = req.headers['idempotency-key'] || body.externalId || '';

  // Idempotency check
  if (idempotencyKey && processedRequests.has(idempotencyKey)) {
    const cached = processedRequests.get(idempotencyKey);
    console.log(`[DFNS Mock] Idempotent replay for ${idempotencyKey}`);
    return respond(res, 200, { ...cached, alreadyExists: true });
  }

  const { externalId, psbtBase64, psbt, psbtId } = body;
  const inputPsbt = psbt || psbtBase64;

  if (!externalId || !inputPsbt) {
    return respond(res, 400, { error: 'Missing externalId or psbt/psbtBase64' });
  }

  // Simulate signing: prefix the PSBT (in real life, DFNS signs the PSBT)
  const signedPsbtBase64 = Buffer.from(`signed:${inputPsbt}`).toString('base64');
  const dfnsRequestId = `dfns-mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = {
    dfnsRequestId,
    externalId,
    signedPsbt: signedPsbtBase64,
    signedPsbtBase64,
    signerMeta: { signerId: 'mock-signer', timestamp: new Date().toISOString() },
    psbtId: psbtId || 'unknown',
    status: 'COMPLETED',
  };

  if (idempotencyKey) {
    processedRequests.set(idempotencyKey, result);
  }

  console.log(`[DFNS Mock] Signed PSBT: externalId=${externalId}, dfnsRequestId=${dfnsRequestId}`);
  respond(res, 200, result);
}

async function handleWebhookTest(req, res) {
  const body = await parseBody(req);
  const { externalId, dfnsRequestId, status, dfnsTxId } = body;

  const webhookPayload = JSON.stringify({
    externalId: externalId || 'test-external-id',
    dfnsRequestId: dfnsRequestId || 'dfns-mock-test',
    status: status || 'COMPLETED',
    dfnsTxId: dfnsTxId || 'mock-txid-' + Date.now(),
  });

  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(webhookPayload)
    .digest('base64');

  try {
    const webhookRes = await fetch(WEBHOOK_TARGET, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DFNS-Signature': signature,
      },
      body: webhookPayload,
    });

    const responseText = await webhookRes.text();
    console.log(`[DFNS Mock] Webhook sent to ${WEBHOOK_TARGET}: status=${webhookRes.status}`);
    respond(res, 200, {
      sent: true,
      target: WEBHOOK_TARGET,
      targetStatus: webhookRes.status,
      targetResponse: responseText,
    });
  } catch (err) {
    console.error(`[DFNS Mock] Webhook failed: ${err.message}`);
    respond(res, 502, { sent: false, error: err.message });
  }
}

const server = createServer(async (req, res) => {
  const { method, url } = req;

  if (method === 'GET' && url === '/health') {
    return respond(res, 200, { status: 'ok', service: 'dfns-mock' });
  }

  if (method === 'POST' && url === '/v1/sign-psbt') {
    return handleSignPsbt(req, res);
  }

  // Match SDK pattern: POST /wallets/{walletId}/sign-psbt
  if (method === 'POST' && url?.match(/^\/wallets\/[^/]+\/sign-psbt$/)) {
    return handleSignPsbt(req, res);
  }

  if (method === 'POST' && url === '/v1/webhook/test') {
    return handleWebhookTest(req, res);
  }

  // Match SDK health check pattern
  if (method === 'GET' && url === '/health') {
    return respond(res, 200, { status: 'ok', service: 'dfns-mock' });
  }

  console.log(`[DFNS Mock] 404 ${method} ${url}`);
  respond(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[DFNS Mock] Server running on http://localhost:${PORT}`);
  console.log(`[DFNS Mock] Webhook target: ${WEBHOOK_TARGET}`);
  console.log(`[DFNS Mock] Endpoints:`);
  console.log(`  POST /v1/sign-psbt      — sign a PSBT (idempotent)`);
  console.log(`  POST /v1/webhook/test    — trigger webhook to target`);
  console.log(`  GET  /health             — health check`);
});
