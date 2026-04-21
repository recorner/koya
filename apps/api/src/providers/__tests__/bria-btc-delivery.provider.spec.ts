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
      newAddress: jest.fn(),
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
                BRIA_PAYOUT_QUEUE_NAME: 'test-queue',
                BTC_NETWORK: 'testnet4',
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
    address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
    amountSatoshis: BigInt(100000),
    referenceCode: 'KYA-ABCD1234',
  };

  it('should submit payout with correct params', async () => {
    briaClient.submitPayout.mockResolvedValue({ id: 'payout-123' });

    const result = await provider.submitPayout(defaultInput);

    expect(result).toEqual({ providerPayoutId: 'payout-123' });
    expect(briaClient.submitPayout).toHaveBeenCalledWith({
      walletName: 'test-wallet',
      payoutQueueName: 'test-queue',
      destination: { onchainAddress: defaultInput.address },
      satoshis: 100000,
      externalId: 'koya:conversion:KYA-ABCD1234',
      metadata: undefined,
    });
  });

  it('should build correct externalId from referenceCode', async () => {
    briaClient.submitPayout.mockResolvedValue({ id: 'payout-456' });

    await provider.submitPayout({ ...defaultInput, referenceCode: 'KYA-XYZ99999' });

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

    const result = await provider.submitPayout(defaultInput);

    expect(result).toEqual({ providerPayoutId: 'payout-existing', txId: 'abc123txid' });
    expect(briaClient.getPayout).toHaveBeenCalledWith({
      externalId: 'koya:conversion:KYA-ABCD1234',
    });
  });

  it('should throw on non-transient error', async () => {
    briaClient.submitPayout.mockRejectedValue(
      new BriaClientError(BriaErrorCode.PERMISSION_DENIED, 'forbidden', 7),
    );

    await expect(provider.submitPayout(defaultInput)).rejects.toThrow('forbidden');
  });

  it('should throw when payout address is on wrong network', async () => {
    await expect(
      provider.submitPayout({
        ...defaultInput,
        address: 'bc1q8fjfrwmf6z4ccz5x4v8x9kz3g6dn6xv3mwt6vc',
      }),
    ).rejects.toThrow('Invalid BTC address for configured network');
  });

  it('should generate a deposit address', async () => {
    briaClient.newAddress.mockResolvedValue({ address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn' });

    const result = await provider.generateDepositAddress({
      externalId: 'koya:deposit:test:1',
      metadata: { context: 'test' },
    });

    expect(result.address).toMatch(/^[mn2]/);
    expect(briaClient.newAddress).toHaveBeenCalledWith({
      walletName: 'test-wallet',
      externalId: 'koya:deposit:test:1',
      metadata: { context: 'test' },
    });
  });
});
