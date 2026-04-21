import { ConfigService } from '@nestjs/config';
import { DfnsBtcDeliveryProvider } from '../dfns-btc-delivery.provider';
import { BriaClientService, BriaClientError, BriaErrorCode } from '@koya/bria-adapter';

describe('DfnsBtcDeliveryProvider', () => {
  let provider: DfnsBtcDeliveryProvider;
  let briaClient: jest.Mocked<BriaClientService>;

  beforeEach(() => {
    briaClient = {
      submitPayout: jest.fn(),
      getPayout: jest.fn(),
      newAddress: jest.fn(),
    } as unknown as jest.Mocked<BriaClientService>;

    const configService = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          BRIA_WALLET_NAME: 'test-wallet',
          BRIA_PAYOUT_QUEUE_NAME: 'test-queue',
          BTC_NETWORK: 'testnet4',
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;

    provider = new DfnsBtcDeliveryProvider(briaClient, configService);
  });

  it('submits payout to Bria and returns provider payout id', async () => {
    briaClient.submitPayout.mockResolvedValue({ id: 'bria-payout-001' });

    const result = await provider.submitPayout({
      address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      amountSatoshis: BigInt(150000),
      referenceCode: 'KYA-TEST123',
    });

    expect(result).toEqual({ providerPayoutId: 'bria-payout-001' });
    expect(briaClient.submitPayout).toHaveBeenCalledWith({
      walletName: 'test-wallet',
      payoutQueueName: 'test-queue',
      destination: { onchainAddress: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn' },
      satoshis: 150000,
      externalId: 'koya:conversion:KYA-TEST123',
      metadata: { referenceCode: 'KYA-TEST123', driver: 'dfns' },
    });
  });

  it('includes custom metadata when provided', async () => {
    briaClient.submitPayout.mockResolvedValue({ id: 'bria-payout-002' });

    await provider.submitPayout({
      address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      amountSatoshis: BigInt(90000),
      referenceCode: 'KYA-META999',
      metadata: { channel: 'telegram' },
    });

    expect(briaClient.submitPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ channel: 'telegram', driver: 'dfns' }),
      }),
    );
  });

  it('throws on Bria submission failure', async () => {
    briaClient.submitPayout.mockRejectedValue(new Error('grpc unavailable'));

    await expect(
      provider.submitPayout({
        address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
        amountSatoshis: BigInt(1000),
        referenceCode: 'KYA-ERR111',
      }),
    ).rejects.toThrow('grpc unavailable');
  });

  it('throws when address network mismatches configured BTC network', async () => {
    await expect(
      provider.submitPayout({
        address: 'bc1q8fjfrwmf6z4ccz5x4v8x9kz3g6dn6xv3mwt6vc',
        amountSatoshis: BigInt(1000),
        referenceCode: 'KYA-WRONGNET',
      }),
    ).rejects.toThrow('Invalid BTC address for configured network');
  });

  it('returns idempotent payout on ALREADY_EXISTS', async () => {
    briaClient.submitPayout.mockRejectedValue(
      new BriaClientError(BriaErrorCode.ALREADY_EXISTS, 'exists'),
    );
    briaClient.getPayout.mockResolvedValue({
      id: 'existing-1',
      externalId: 'koya:conversion:KYA-123',
      txId: 'tx-abc',
      walletId: 'w1',
      payoutQueueId: 'q1',
      satoshis: 123,
      cancelled: false,
    } as any);

    const result = await provider.submitPayout({
      address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      amountSatoshis: BigInt(123),
      referenceCode: 'KYA-123',
    });

    expect(result).toEqual({ providerPayoutId: 'existing-1', txId: 'tx-abc' });
  });

  it('can generate deposit addresses via Bria', async () => {
    briaClient.newAddress.mockResolvedValue({
      address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
    });

    const result = await provider.generateDepositAddress({ externalId: 'koya:deposit:ctx:1' });

    expect(result.address).toMatch(/^[mn2]/);
    expect(briaClient.newAddress).toHaveBeenCalledWith({
      walletName: 'test-wallet',
      externalId: 'koya:deposit:ctx:1',
      metadata: undefined,
    });
  });
});
