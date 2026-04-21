import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BtcBackendService } from '../btc-backend.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BTC_BACKEND_PROVIDER } from '../../providers/btc-backend.interface';

describe('BtcBackendService', () => {
  let service: BtcBackendService;
  let prisma: any;
  let backend: any;

  beforeEach(async () => {
    prisma = {
      conversionSession: {
        findUnique: jest.fn(),
      },
      btcDepositAddress: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    backend = {
      backend: 'bria',
      generateDepositAddress: jest.fn(),
      healthMetadata: jest.fn().mockReturnValue({ backend: 'bria', healthy: true, capabilities: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BtcBackendService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn((k: string) => (k === 'BTC_NETWORK' ? 'testnet4' : 'koya-wallet')) } },
        { provide: BTC_BACKEND_PROVIDER, useValue: backend },
      ],
    }).compile();

    service = module.get(BtcBackendService);
  });

  it('issues and persists a deposit address', async () => {
    backend.generateDepositAddress.mockResolvedValue({
      address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      externalId: 'koya:deposit:test:1',
    });

    prisma.btcDepositAddress.findUnique.mockResolvedValue(null);
    prisma.btcDepositAddress.create.mockResolvedValue({
      id: 'addr-1',
      address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      externalId: 'koya:deposit:test:1',
      backend: 'bria',
      btcNetwork: 'testnet4',
      walletName: 'koya-wallet',
    });

    const result = await service.issueDepositAddress({
      businessContextType: 'conversion_session',
      businessContextRef: 'KYA-1234',
      externalId: 'koya:deposit:test:1',
    });

    expect(result.address).toBe('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn');
    expect(prisma.btcDepositAddress.create).toHaveBeenCalled();
  });

  it('returns existing record for idempotent externalId', async () => {
    prisma.btcDepositAddress.findUnique.mockResolvedValue({
      id: 'addr-1',
      address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      externalId: 'koya:deposit:test:1',
      backend: 'bria',
      btcNetwork: 'testnet4',
      walletName: 'koya-wallet',
    });

    const result = await service.issueDepositAddress({
      businessContextType: 'conversion_session',
      businessContextRef: 'KYA-1234',
      externalId: 'koya:deposit:test:1',
    });

    expect(result.externalId).toBe('koya:deposit:test:1');
    expect(backend.generateDepositAddress).not.toHaveBeenCalled();
  });
});
