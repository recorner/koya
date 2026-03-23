import { ConfigService } from '@nestjs/config';
import { DfnsService } from '../dfns.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock @koya/dfns-sdk
const mockRequestSignPsbt = jest.fn();
const mockVerifyWebhookSignature = jest.fn();

jest.mock('@koya/dfns-sdk', () => ({
  DFNSClient: jest.fn().mockImplementation(() => ({
    requestSignPsbt: mockRequestSignPsbt,
    verifyWebhookSignature: mockVerifyWebhookSignature,
  })),
}));

// Mock fs for mTLS cert reading
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => Buffer.from('mock-cert-data')),
}));

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
    it('should submit custody move via SDK and persist request', async () => {
      (prisma.dfnsRequest.findUnique as jest.Mock).mockResolvedValue(null);

      mockRequestSignPsbt.mockResolvedValue({
        dfnsRequestId: 'dfns-transfer-001',
        status: 'PENDING',
      });

      (prisma.dfnsRequest.create as jest.Mock).mockResolvedValue({
        id: 'db-id-001',
        externalId: 'koya:conversion:KYA-TEST01',
        dfnsRequestId: 'dfns-transfer-001',
        status: 'PENDING',
      });

      const result = await service.requestCustodyMove({
        externalId: 'koya:conversion:KYA-TEST01',
        destination: 'tb1qtest',
        satoshis: 100000,
      });

      expect(result.dfnsRequestId).toBe('dfns-transfer-001');
      expect(result.status).toBe('PENDING');
      expect(mockRequestSignPsbt).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: 'koya:conversion:KYA-TEST01',
        }),
      );
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
      expect(mockRequestSignPsbt).not.toHaveBeenCalled();
    });

    it('should throw on SDK error', async () => {
      (prisma.dfnsRequest.findUnique as jest.Mock).mockResolvedValue(null);

      mockRequestSignPsbt.mockRejectedValue(new Error('DFNS API error'));

      await expect(
        service.requestCustodyMove({
          externalId: 'koya:conversion:KYA-BAD',
          destination: 'invalid',
          satoshis: 0,
        }),
      ).rejects.toThrow('DFNS API error');
    });

    it('should handle 409 conflict (idempotent via SDK)', async () => {
      (prisma.dfnsRequest.findUnique as jest.Mock).mockResolvedValue(null);

      mockRequestSignPsbt.mockResolvedValue({
        dfnsRequestId: 'dfns-conflict-id',
        status: 'PENDING',
        alreadyExists: true,
      });

      (prisma.dfnsRequest.create as jest.Mock).mockResolvedValue({
        id: 'db-conflict',
        externalId: 'koya:conversion:KYA-CONF',
        dfnsRequestId: 'dfns-conflict-id',
        status: 'PENDING',
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
    it('should delegate to SDK for verification', () => {
      mockVerifyWebhookSignature.mockReturnValue(true);

      const result = service.verifyWebhookSignature(
        '{"id":"test","status":"Executed"}',
        'valid-signature',
      );

      expect(result).toBe(true);
      expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(
        '{"id":"test","status":"Executed"}',
        'valid-signature',
        'test-webhook-secret',
      );
    });

    it('should reject invalid signature', () => {
      mockVerifyWebhookSignature.mockReturnValue(false);

      const result = service.verifyWebhookSignature(
        '{"id":"test"}',
        'deadbeef',
      );
      expect(result).toBe(false);
    });

    it('should reject when client not initialized', () => {
      const noConfig = {
        get: jest.fn(() => ''),
      } as unknown as ConfigService;

      const svc = new DfnsService(noConfig, prisma);
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
