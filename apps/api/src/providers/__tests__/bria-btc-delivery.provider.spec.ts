import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BriaBtcDeliveryProvider } from '../bria-btc-delivery.provider';
import { BriaClientService, BriaClientError, BriaErrorCode } from '@koya/bria-adapter';

describe('BriaBtcDeliveryProvider', () => {
  let provider: BriaBtcDeliveryProvider;
  let briaClient: jest.Mocked<BriaClientService>;

  beforeEach(async () => {
    const mockBriaClient = {
      submitPayout: jest.fn(),
      getPayout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BriaBtcDeliveryProvider,
        { provide: BriaClientService, useValue: mockBriaClient },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                BRIA_WALLET_NAME: 'test-wallet',
                BRIA_PAYOUT_QUEUE: 'test-queue',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get(BriaBtcDeliveryProvider);
    briaClient = module.get(BriaClientService);
  });

  const defaultInput = {
    address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    amountSatoshis: BigInt(100000),
    referenceCode: 'KYA-ABCD1234',
  };

  it('should submit payout with correct params', async () => {
    briaClient.submitPayout.mockResolvedValue({ id: 'payout-123' });

    const result = await provider.send(defaultInput);

    expect(result).toEqual({ success: true, txHash: 'payout-123', confirmations: 0 });
    expect(briaClient.submitPayout).toHaveBeenCalledWith({
      walletName: 'test-wallet',
      payoutQueueName: 'test-queue',
      destination: { onchainAddress: defaultInput.address },
      satoshis: 100000,
      externalId: 'koya:conversion:KYA-ABCD1234',
    });
  });

  it('should build correct externalId from referenceCode', async () => {
    briaClient.submitPayout.mockResolvedValue({ id: 'payout-456' });

    await provider.send({ ...defaultInput, referenceCode: 'KYA-XYZ99999' });

    expect(briaClient.submitPayout).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'koya:conversion:KYA-XYZ99999' }),
    );
  });

  it('should handle ALREADY_EXISTS as idempotent success', async () => {
    briaClient.submitPayout.mockRejectedValue(
      new BriaClientError(BriaErrorCode.ALREADY_EXISTS, 'payout exists', 6),
    );
    briaClient.getPayout.mockResolvedValue({
      id: 'payout-existing',
      walletId: 'w1',
      payoutQueueId: 'q1',
      satoshis: 100000,
      cancelled: false,
      externalId: 'koya:conversion:KYA-ABCD1234',
      txId: 'abc123txid',
    } as any);

    const result = await provider.send(defaultInput);

    expect(result).toEqual({ success: true, txHash: 'abc123txid', confirmations: 0 });
    expect(briaClient.getPayout).toHaveBeenCalledWith({
      externalId: 'koya:conversion:KYA-ABCD1234',
    });
  });

  it('should return success with empty txHash if existing payout has no txId', async () => {
    briaClient.submitPayout.mockRejectedValue(
      new BriaClientError(BriaErrorCode.ALREADY_EXISTS, 'payout exists', 6),
    );
    briaClient.getPayout.mockResolvedValue({
      id: 'payout-existing',
      walletId: 'w1',
      payoutQueueId: 'q1',
      satoshis: 100000,
      cancelled: false,
      externalId: 'koya:conversion:KYA-ABCD1234',
    } as any);

    const result = await provider.send(defaultInput);

    expect(result).toEqual({ success: true, txHash: '', confirmations: 0 });
  });

  it('should return failure on non-transient error', async () => {
    briaClient.submitPayout.mockRejectedValue(
      new BriaClientError(BriaErrorCode.PERMISSION_DENIED, 'forbidden', 7),
    );

    const result = await provider.send(defaultInput);

    expect(result).toEqual({ success: false, txHash: '', confirmations: 0 });
  });

  it('should return failure when ALREADY_EXISTS lookup fails', async () => {
    briaClient.submitPayout.mockRejectedValue(
      new BriaClientError(BriaErrorCode.ALREADY_EXISTS, 'payout exists', 6),
    );
    briaClient.getPayout.mockRejectedValue(new Error('lookup failed'));

    const result = await provider.send(defaultInput);

    expect(result).toEqual({ success: false, txHash: '', confirmations: 0 });
  });
});
