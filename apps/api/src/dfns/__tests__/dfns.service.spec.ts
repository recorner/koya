import { ConfigService } from '@nestjs/config';
import { DfnsService } from '../dfns.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DfnsService', () => {
  let service: DfnsService;
  let prisma: jest.Mocked<PrismaService>;
  let configService: ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      dfnsRequest: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          DFNS_API_URL: 'https://api.dfns.ninja/v2',
          DFNS_API_KEY: 'test-api-key',
          DFNS_APP_ID: 'test-app-id',
          DFNS_WALLET_ID: 'wallet-001',
          DFNS_WEBHOOK_URL: 'https://test.example.com/dfns/webhook',
          DFNS_WEBHOOK_SECRET: 'test-webhook-secret',
        };
        return config[key] ?? defaultValue ?? '';
      }),
    } as unknown as ConfigService;

    service = new DfnsService(configService, prisma);
  });

  describe('requestCustodyMove', () => {
    it('should submit custody move and persist request', async () => {
      (prisma.dfnsRequest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.dfnsRequest.create as jest.Mock).mockResolvedValue({
        id: 'db-id-001',
        externalId: 'koya:conversion:KYA-TEST01',
        dfnsRequestId: 'dfns-transfer-001',
        status: 'PENDING',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'dfns-transfer-001',
          status: 'Pending',
        }),
      });

      const result = await service.requestCustodyMove({
        externalId: 'koya:conversion:KYA-TEST01',
        destination: 'tb1qtest',
        satoshis: 100000,
      });

      expect(result.dfnsRequestId).toBe('dfns-transfer-001');
      expect(result.status).toBe('PENDING');
      expect(prisma.dfnsRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            externalId: 'koya:conversion:KYA-TEST01',
            dfnsRequestId: 'dfns-transfer-001',
          }),
        }),
      );
    });

    it('should return existing request for duplicate externalId', async () => {
      (prisma.dfnsRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        externalId: 'koya:conversion:KYA-DUPE',
        dfnsRequestId: 'dfns-existing',
        status: 'PENDING',
      });

      const result = await service.requestCustodyMove({
        externalId: 'koya:conversion:KYA-DUPE',
        destination: 'tb1qtest',
        satoshis: 50000,
      });

      expect(result.dfnsRequestId).toBe('dfns-existing');
      expect(result.status).toBe('PENDING');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw on permanent API error', async () => {
      (prisma.dfnsRequest.findUnique as jest.Mock).mockResolvedValue(null);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      await expect(
        service.requestCustodyMove({
          externalId: 'koya:conversion:KYA-BAD',
          destination: 'invalid',
          satoshis: 0,
        }),
      ).rejects.toThrow('DFNS API error: 400');
    });

    it('should handle 409 conflict as idempotent', async () => {
      (prisma.dfnsRequest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.dfnsRequest.create as jest.Mock).mockResolvedValue({
        id: 'db-conflict',
        externalId: 'koya:conversion:KYA-CONF',
        dfnsRequestId: 'dfns-conflict-id',
        status: 'PENDING',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          id: 'dfns-conflict-id',
          status: 'Pending',
        }),
      });

      const result = await service.requestCustodyMove({
        externalId: 'koya:conversion:KYA-CONF',
        destination: 'tb1qconftest',
        satoshis: 30000,
      });

      expect(result.dfnsRequestId).toBe('dfns-conflict-id');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid HMAC signature', () => {
      const crypto = require('crypto');
      const secret = 'test-webhook-secret';
      const payload = '{"id":"test","status":"Executed"}';
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const result = service.verifyWebhookSignature(payload, expectedSig);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const result = service.verifyWebhookSignature(
        '{"id":"test"}',
        'deadbeef',
      );
      expect(result).toBe(false);
    });

    it('should reject when no secret configured', () => {
      const noSecretConfig = {
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === 'DFNS_WEBHOOK_SECRET') return '';
          return defaultValue ?? '';
        }),
      } as unknown as ConfigService;

      const svc = new DfnsService(noSecretConfig, prisma);
      expect(svc.verifyWebhookSignature('payload', 'sig')).toBe(false);
    });
  });

  describe('updateRequestStatus', () => {
    it('should update status and txId', async () => {
      (prisma.dfnsRequest.update as jest.Mock).mockResolvedValue({
        externalId: 'koya:conversion:KYA-UPD',
        status: 'COMPLETED',
        dfnsTxId: 'tx-abc123',
      });

      await service.updateRequestStatus(
        'koya:conversion:KYA-UPD',
        'COMPLETED',
        'tx-abc123',
      );

      expect(prisma.dfnsRequest.update).toHaveBeenCalledWith({
        where: { externalId: 'koya:conversion:KYA-UPD' },
        data: { status: 'COMPLETED', dfnsTxId: 'tx-abc123' },
      });
    });
  });
});
