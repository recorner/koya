import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

// Mock @koya/bria-adapter before importing anything that references it
jest.mock('@koya/bria-adapter', () => ({
  BriaClientService: jest.fn(),
}));

// Must import after mock setup
import { BriaClientService } from '@koya/bria-adapter';
import { PsbtSigningService } from '../psbt-signing.service';

// Mock @koya/dfns-sdk
const mockRequestSignPsbt = jest.fn();

jest.mock('@koya/dfns-sdk', () => ({
  DFNSClient: jest.fn().mockImplementation(() => ({
    requestSignPsbt: mockRequestSignPsbt,
  })),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => Buffer.from('mock-cert-data')),
}));

jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutMetricDataCommand: jest.fn(),
}));

describe('PsbtSigningService', () => {
  let service: PsbtSigningService;
  let prisma: jest.Mocked<PrismaService>;
  let briaClient: jest.Mocked<BriaClientService>;

  const configValues: Record<string, string> = {
    DFNS_API_URL: 'https://api.dfns.ninja/v2',
    DFNS_API_KEY: 'test-api-key',
    DFNS_APP_ID: 'test-app-id',
    DFNS_WALLET_ID: 'wallet-001',
    BRIA_XPUB_REF: 'test-xpub-ref',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      payoutPsbt: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    briaClient = {
      getBatch: jest.fn(),
      submitSignedPsbt: jest.fn(),
    } as unknown as jest.Mocked<BriaClientService>;

    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => configValues[key] ?? defaultValue ?? ''),
    } as unknown as ConfigService;

    service = new PsbtSigningService(prisma, briaClient, configService, null);
  });

  describe('handlePayoutCommitted', () => {
    const payoutId = 'bria-payout-001';
    const externalId = 'koya:conversion:KYA-TEST01';
    const batchId = 'batch-abc';

    it('should complete full Bria → DFNS → Bria flow', async () => {
      (prisma.payoutPsbt.findUnique as jest.Mock).mockResolvedValue(null);
      (briaClient.getBatch as jest.Mock).mockResolvedValue({
        id: batchId,
        unsignedPsbt: 'cHNidC1iYXNlNjQ=', // base64
      });
      (prisma.payoutPsbt.create as jest.Mock).mockResolvedValue({
        id: 'psbt-001',
        externalId,
        psbtBase64: 'cHNidC1iYXNlNjQ=',
        psbtStatus: 'signing_pending',
      });
      mockRequestSignPsbt.mockResolvedValue({
        dfnsRequestId: 'dfns-req-001',
        signedPsbtBase64: 'c2lnbmVkLXBzYnQ=',
      });
      (prisma.payoutPsbt.update as jest.Mock).mockResolvedValue({});
      (briaClient.submitSignedPsbt as jest.Mock).mockResolvedValue(undefined);

      await service.handlePayoutCommitted(payoutId, externalId, batchId);

      // Step 1: Got unsigned PSBT from Bria
      expect(briaClient.getBatch).toHaveBeenCalledWith(batchId);

      // Step 2: Persisted PSBT metadata
      expect(prisma.payoutPsbt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          externalId,
          psbtBase64: 'cHNidC1iYXNlNjQ=',
          psbtStatus: 'signing_pending',
        }),
      });

      // Step 3: Sent to DFNS
      expect(mockRequestSignPsbt).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId,
          psbtBase64: 'cHNidC1iYXNlNjQ=',
          psbtId: batchId,
        }),
      );

      // Step 4: Updated with signed PSBT
      expect(prisma.payoutPsbt.update).toHaveBeenCalledWith({
        where: { id: 'psbt-001' },
        data: expect.objectContaining({
          signedPsbtBase64: 'c2lnbmVkLXBzYnQ=',
          dfnsRequestId: 'dfns-req-001',
          psbtStatus: 'signed',
        }),
      });

      // Step 5: Submitted signed PSBT to Bria
      expect(briaClient.submitSignedPsbt).toHaveBeenCalledWith({
        batchId,
        xpubRef: 'test-xpub-ref',
        signedPsbt: 'c2lnbmVkLXBzYnQ=',
      });
    });

    it('should skip if already signed (idempotent)', async () => {
      (prisma.payoutPsbt.findUnique as jest.Mock).mockResolvedValue({
        id: 'psbt-existing',
        externalId,
        psbtStatus: 'signed',
      });

      await service.handlePayoutCommitted(payoutId, externalId, batchId);

      expect(briaClient.getBatch).not.toHaveBeenCalled();
      expect(mockRequestSignPsbt).not.toHaveBeenCalled();
    });

    it('should skip if already broadcast (idempotent)', async () => {
      (prisma.payoutPsbt.findUnique as jest.Mock).mockResolvedValue({
        id: 'psbt-broadcast',
        externalId,
        psbtStatus: 'broadcast',
      });

      await service.handlePayoutCommitted(payoutId, externalId, batchId);

      expect(briaClient.getBatch).not.toHaveBeenCalled();
    });

    it('should retry existing unsigned record', async () => {
      // Record exists but is still unsigned — retry the flow
      (prisma.payoutPsbt.findUnique as jest.Mock).mockResolvedValue({
        id: 'psbt-retry',
        externalId,
        psbtStatus: 'unsigned',
      });
      (briaClient.getBatch as jest.Mock).mockResolvedValue({
        id: batchId,
        unsignedPsbt: 'cmV0cnktcHNidA==',
      });
      (prisma.payoutPsbt.update as jest.Mock).mockResolvedValue({
        id: 'psbt-retry',
        externalId,
        psbtStatus: 'signing_pending',
      });
      mockRequestSignPsbt.mockResolvedValue({
        dfnsRequestId: 'dfns-retry-001',
        signedPsbtBase64: 'c2lnbmVkLXJldHJ5',
      });
      (briaClient.submitSignedPsbt as jest.Mock).mockResolvedValue(undefined);

      await service.handlePayoutCommitted(payoutId, externalId, batchId);

      // Should update existing record instead of creating new
      expect(prisma.payoutPsbt.update).toHaveBeenCalledWith({
        where: { externalId },
        data: expect.objectContaining({ psbtStatus: 'signing_pending' }),
      });
      expect(prisma.payoutPsbt.create).not.toHaveBeenCalled();
    });

    it('should handle missing unsigned PSBT in batch', async () => {
      (prisma.payoutPsbt.findUnique as jest.Mock).mockResolvedValue(null);
      (briaClient.getBatch as jest.Mock).mockResolvedValue({
        id: batchId,
        unsignedPsbt: '',
      });

      await service.handlePayoutCommitted(payoutId, externalId, batchId);

      expect(mockRequestSignPsbt).not.toHaveBeenCalled();
      expect(prisma.payoutPsbt.create).not.toHaveBeenCalled();
    });

    it('should mark failed on DFNS signing error', async () => {
      (prisma.payoutPsbt.findUnique as jest.Mock).mockResolvedValue(null);
      (briaClient.getBatch as jest.Mock).mockResolvedValue({
        id: batchId,
        unsignedPsbt: 'cHNidC1kYXRh',
      });
      (prisma.payoutPsbt.create as jest.Mock).mockResolvedValue({
        id: 'psbt-fail',
        externalId,
        psbtStatus: 'signing_pending',
      });
      mockRequestSignPsbt.mockRejectedValue(new Error('DFNS timeout'));
      (prisma.payoutPsbt.update as jest.Mock).mockResolvedValue({});

      await expect(
        service.handlePayoutCommitted(payoutId, externalId, batchId),
      ).rejects.toThrow('DFNS timeout');

      expect(prisma.payoutPsbt.update).toHaveBeenCalledWith({
        where: { id: 'psbt-fail' },
        data: { psbtStatus: 'failed' },
      });
    });
  });

  describe('markSettled', () => {
    it('should update record to settled with txid', async () => {
      (prisma.payoutPsbt.findUnique as jest.Mock).mockResolvedValue({
        id: 'psbt-settle',
        externalId: 'koya:conversion:KYA-SETTLE',
        psbtStatus: 'broadcast',
      });
      (prisma.payoutPsbt.update as jest.Mock).mockResolvedValue({});

      await service.markSettled('koya:conversion:KYA-SETTLE', 'txid-abc123');

      expect(prisma.payoutPsbt.update).toHaveBeenCalledWith({
        where: { id: 'psbt-settle' },
        data: { psbtStatus: 'settled', txid: 'txid-abc123' },
      });
    });

    it('should silently skip if no record found', async () => {
      (prisma.payoutPsbt.findUnique as jest.Mock).mockResolvedValue(null);

      await service.markSettled('koya:conversion:KYA-UNKNOWN', 'txid-xyz');

      expect(prisma.payoutPsbt.update).not.toHaveBeenCalled();
    });
  });
});
