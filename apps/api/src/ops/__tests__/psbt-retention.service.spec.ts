import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PsbtRetentionService } from '../psbt-retention.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock the S3 SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
}));

describe('PsbtRetentionService', () => {
  let service: PsbtRetentionService;
  let prisma: {
    payoutPsbt: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
  };

  const configValues: Record<string, string> = {};

  beforeEach(async () => {
    mockSend.mockReset();

    prisma = {
      payoutPsbt: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };

    configValues['PSBT_ARCHIVE_S3_BUCKET'] = '';
    configValues['PSBT_ARCHIVE_KMS_KEY_ID'] = '';
    configValues['AWS_REGION'] = 'us-east-1';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PsbtRetentionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => configValues[key] ?? fallback ?? ''),
          },
        },
      ],
    }).compile();

    service = module.get(PsbtRetentionService);
  });

  it('should return 0 when no PSBTs are eligible', async () => {
    prisma.payoutPsbt.findMany.mockResolvedValue([]);

    const result = await service.archiveOldPsbts();
    expect(result).toEqual({ archived: 0 });
    expect(prisma.payoutPsbt.update).not.toHaveBeenCalled();
  });

  it('should archive settled PSBTs older than 90 days (no S3)', async () => {
    const candidates = [
      { id: 'psbt-1', externalId: 'ext-1', psbtBase64: 'psbt1', signedPsbtBase64: 'signed1', updatedAt: new Date('2025-01-01') },
      { id: 'psbt-2', externalId: 'ext-2', psbtBase64: 'psbt2', signedPsbtBase64: null, updatedAt: new Date('2025-01-15') },
    ];
    prisma.payoutPsbt.findMany.mockResolvedValue(candidates);
    prisma.payoutPsbt.update.mockResolvedValue({});

    const result = await service.archiveOldPsbts();

    expect(result).toEqual({ archived: 2 });
    expect(prisma.payoutPsbt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          psbtStatus: { in: ['settled', 'failed'] },
        }),
      }),
    );
    expect(prisma.payoutPsbt.update).toHaveBeenCalledTimes(2);
    expect(prisma.payoutPsbt.update).toHaveBeenCalledWith({
      where: { id: 'psbt-1' },
      data: {
        psbtBase64: '[archived]',
        signedPsbtBase64: null,
        psbtStatus: 'archived',
      },
    });
  });
});

describe('PsbtRetentionService (with S3)', () => {
  let service: PsbtRetentionService;
  let prisma: {
    payoutPsbt: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockSend.mockReset();

    prisma = {
      payoutPsbt: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const configValues: Record<string, string> = {
      PSBT_ARCHIVE_S3_BUCKET: 'koya-archives',
      PSBT_ARCHIVE_KMS_KEY_ID: 'arn:aws:kms:us-east-1:123:key/abc',
      AWS_REGION: 'us-east-1',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PsbtRetentionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => configValues[key] ?? fallback ?? ''),
          },
        },
      ],
    }).compile();

    service = module.get(PsbtRetentionService);
  });

  it('should upload to S3 before archiving', async () => {
    const candidates = [
      { id: 'psbt-1', externalId: 'ext-1', psbtBase64: 'psbt-data', signedPsbtBase64: 'signed-data', updatedAt: new Date('2025-06-15') },
    ];
    prisma.payoutPsbt.findMany.mockResolvedValue(candidates);
    prisma.payoutPsbt.update.mockResolvedValue({});
    mockSend.mockResolvedValue({});

    const result = await service.archiveOldPsbts();

    expect(result).toEqual({ archived: 1 });
    expect(mockSend).toHaveBeenCalledTimes(1);
    // Verify the PutObjectCommand was called with correct S3 key
    const putCmd = mockSend.mock.calls[0]![0];
    expect(putCmd.Bucket).toBe('koya-archives');
    expect(putCmd.Key).toBe('payout_psbts/2025/06/ext-1.psbt.gz');
    expect(putCmd.ServerSideEncryption).toBe('aws:kms');
    expect(putCmd.SSEKMSKeyId).toBe('arn:aws:kms:us-east-1:123:key/abc');
  });

  it('should skip DB update when S3 upload fails', async () => {
    const candidates = [
      { id: 'psbt-1', externalId: 'ext-1', psbtBase64: 'psbt-data', signedPsbtBase64: null, updatedAt: new Date('2025-06-15') },
    ];
    prisma.payoutPsbt.findMany.mockResolvedValue(candidates);
    mockSend.mockRejectedValue(new Error('S3 access denied'));

    const result = await service.archiveOldPsbts();

    expect(result).toEqual({ archived: 0 });
    expect(prisma.payoutPsbt.update).not.toHaveBeenCalled();
  });
});
