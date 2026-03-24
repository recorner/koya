import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReconciliationService } from '../reconciliation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BriaClientService } from '@koya/bria-adapter';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let prisma: { payoutInstruction: { findMany: jest.Mock } };
  let briaClient: { getPayout: jest.Mock };

  beforeEach(async () => {
    prisma = {
      payoutInstruction: {
        findMany: jest.fn(),
      },
    };

    briaClient = {
      getPayout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: PrismaService, useValue: prisma },
        { provide: BriaClientService, useValue: briaClient },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => fallback ?? ''),
          },
        },
      ],
    }).compile();

    service = module.get(ReconciliationService);
  });

  it('should return empty result when no payouts in window', async () => {
    prisma.payoutInstruction.findMany.mockResolvedValue([]);

    const result = await service.reconcile(24);
    expect(result.totalPayouts).toBe(0);
    expect(result.matched).toBe(0);
    expect(result.mismatches).toEqual([]);
    expect(result.absDeltaSats).toBe(0);
  });

  it('should match when Koya and Bria amounts agree', async () => {
    prisma.payoutInstruction.findMany.mockResolvedValue([
      { id: 'pi-1', externalId: 'ext-1', amountMinor: BigInt(50000), txHash: 'tx-1' },
    ]);
    briaClient.getPayout.mockResolvedValue({
      id: 'bria-1',
      externalId: 'ext-1',
      satoshis: 50000,
    });

    const result = await service.reconcile(24);
    expect(result.totalPayouts).toBe(1);
    expect(result.matched).toBe(1);
    expect(result.mismatches).toEqual([]);
    expect(result.absDeltaSats).toBe(0);
  });

  it('should report mismatch when amounts differ', async () => {
    prisma.payoutInstruction.findMany.mockResolvedValue([
      { id: 'pi-2', externalId: 'ext-2', amountMinor: BigInt(50000), txHash: 'tx-2' },
    ]);
    briaClient.getPayout.mockResolvedValue({
      id: 'bria-2',
      externalId: 'ext-2',
      satoshis: 49500, // 500 sats off
    });

    const result = await service.reconcile(24);
    expect(result.totalPayouts).toBe(1);
    expect(result.matched).toBe(0);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]!.deltaSats).toBe(-500);
    expect(result.absDeltaSats).toBe(500);
  });

  it('should handle Bria lookup failure gracefully', async () => {
    prisma.payoutInstruction.findMany.mockResolvedValue([
      { id: 'pi-3', externalId: 'ext-3', amountMinor: BigInt(10000), txHash: 'tx-3' },
    ]);
    briaClient.getPayout.mockRejectedValue(new Error('gRPC unavailable'));

    const result = await service.reconcile(24);
    expect(result.totalPayouts).toBe(1);
    expect(result.matched).toBe(0);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]!.reason).toContain('bria_lookup_failed');
  });
});
