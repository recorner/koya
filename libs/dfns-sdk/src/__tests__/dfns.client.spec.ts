import { DFNSClient } from '../dfns.client';
import { DfnsTransientError, DfnsPermanentError } from '../dfns.errors';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function createClient(overrides?: Partial<ConstructorParameters<typeof DFNSClient>[0]>) {
  return new DFNSClient({
    baseUrl: 'https://api.dfns.test/v2',
    appId: 'test-app',
    walletId: 'test-wallet',
    apiKey: 'test-key',
    maxRetries: 0, // no retries in unit tests
    timeoutMs: 5000,
    ...overrides,
  });
}

function mockResponse(status: number, body: Record<string, unknown>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('DFNSClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('requestSignPsbt', () => {
    it('should sign a PSBT successfully', async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, {
          dfnsRequestId: 'dfns-123',
          signedPsbt: 'signed-base64',
          signerMeta: { signerId: 'signer-1', timestamp: '2026-03-23T00:00:00Z' },
        }),
      );

      const result = await client.requestSignPsbt({
        externalId: 'koya:conversion:abc',
        psbtBase64: 'unsigned-base64',
        psbtId: 'batch-1',
      });

      expect(result.dfnsRequestId).toBe('dfns-123');
      expect(result.signedPsbtBase64).toBe('signed-base64');
      expect(result.signerMeta.signerId).toBe('signer-1');
      expect(result.alreadyExists).toBeUndefined();

      // Verify headers
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.dfns.test/v2/wallets/test-wallet/sign-psbt');
      const headers = opts.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-key');
      expect(headers['Idempotency-Key']).toBe('koya:conversion:abc');
      expect(headers['X-DFNS-App']).toBe('test-app');
    });

    it('should handle 409 ALREADY_EXISTS as success', async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        mockResponse(409, {
          dfnsRequestId: 'dfns-existing',
          signedPsbt: 'existing-signed-base64',
          signerMeta: { signerId: 'signer-1', timestamp: '2026-03-23T00:00:00Z' },
        }),
      );

      const result = await client.requestSignPsbt({
        externalId: 'koya:conversion:abc',
        psbtBase64: 'unsigned-base64',
      });

      expect(result.dfnsRequestId).toBe('dfns-existing');
      expect(result.signedPsbtBase64).toBe('existing-signed-base64');
      expect(result.alreadyExists).toBe(true);
    });

    it('should throw DfnsPermanentError on 4xx', async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(mockResponse(400, { error: 'Bad request' }));

      await expect(
        client.requestSignPsbt({
          externalId: 'koya:conversion:abc',
          psbtBase64: 'unsigned-base64',
        }),
      ).rejects.toThrow(DfnsPermanentError);
    });

    it('should throw DfnsTransientError on 5xx', async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(mockResponse(502, { error: 'Bad gateway' }));

      await expect(
        client.requestSignPsbt({
          externalId: 'koya:conversion:abc',
          psbtBase64: 'unsigned-base64',
        }),
      ).rejects.toThrow(DfnsTransientError);
    });

    it('should throw DfnsTransientError on network error', async () => {
      const client = createClient();
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        client.requestSignPsbt({
          externalId: 'koya:conversion:abc',
          psbtBase64: 'unsigned-base64',
        }),
      ).rejects.toThrow(DfnsTransientError);
    });

    it('should use custom walletId when provided', async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, {
          dfnsRequestId: 'dfns-123',
          signedPsbt: 'signed',
          signerMeta: { signerId: 's', timestamp: 't' },
        }),
      );

      await client.requestSignPsbt({
        externalId: 'koya:conversion:abc',
        psbtBase64: 'unsigned',
        walletId: 'custom-wallet',
      });

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.dfns.test/v2/wallets/custom-wallet/sign-psbt');
    });
  });

  describe('getRequestStatus', () => {
    it('should return request status', async () => {
      const client = createClient();
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, { status: 'COMPLETED', txId: 'abc123' }),
      );

      const result = await client.getRequestStatus('dfns-123');

      expect(result.status).toBe('COMPLETED');
      expect(result.dfnsTxId).toBe('abc123');
      expect(result.raw).toEqual({ status: 'COMPLETED', txId: 'abc123' });
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify a valid HMAC signature', () => {
      const client = createClient();
      const crypto = require('crypto') as typeof import('crypto');
      const secret = 'test-secret';
      const body = '{"externalId":"abc"}';
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');

      expect(client.verifyWebhookSignature(body, sig, secret)).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const client = createClient();
      expect(client.verifyWebhookSignature('body', 'bad', 'secret')).toBe(false);
    });

    it('should reject when no secret provided', () => {
      const client = createClient();
      expect(client.verifyWebhookSignature('body', 'sig', '')).toBe(false);
    });
  });

  describe('parseAndVerifyWebhook', () => {
    it('should parse and verify a valid webhook', () => {
      const client = createClient();
      const crypto = require('crypto') as typeof import('crypto');
      const secret = 'webhook-secret';
      const body = JSON.stringify({
        externalId: 'koya:conversion:abc',
        dfnsRequestId: 'dfns-123',
        status: 'COMPLETED',
        dfnsTxId: 'txid-456',
      });
      const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');

      const result = client.parseAndVerifyWebhook(body, sig, secret);

      expect(result.externalId).toBe('koya:conversion:abc');
      expect(result.dfnsRequestId).toBe('dfns-123');
      expect(result.status).toBe('COMPLETED');
      expect(result.dfnsTxId).toBe('txid-456');
    });

    it('should throw on invalid signature', () => {
      const client = createClient();
      expect(() =>
        client.parseAndVerifyWebhook('{}', 'bad-sig', 'secret'),
      ).toThrow(DfnsPermanentError);
    });
  });
});
