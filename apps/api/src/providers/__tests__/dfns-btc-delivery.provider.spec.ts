import { ConfigService } from '@nestjs/config';
import { DfnsBtcDeliveryProvider } from '../dfns-btc-delivery.provider';
import { BriaClientService } from '@koya/bria-adapter';

describe('DfnsBtcDeliveryProvider', () => {
  let provider: DfnsBtcDeliveryProvider;
  let briaClient: jest.Mocked<BriaClientService>;
  let configService: ConfigService;

  beforeEach(() => {
    briaClient = {
      submitPayout: jest.fn(),
    } as unknown as jest.Mocked<BriaClientService>;

    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          BRIA_WALLET_NAME: 'test-wallet',
          BRIA_PAYOUT_QUEUE_NAME: 'test-queue',
          BTC_NETWORK: 'testnet4',
        };
        return config[key] ?? defaultValue ?? '';
      }),
    } as unknown as ConfigService;

    provider = new DfnsBtcDeliveryProvider(briaClient, configService);
  });

  it('should submit payout to Bria with correct params', async () => {
    briaClient.submitPayout.mockResolvedValue({
      id: 'bria-payout-001',
    });

    const result = await provider.send({
      address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      amountSatoshis: BigInt(100000),
      referenceCode: 'KYA-TEST01',
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBe('bria-payout-001');
    expect(result.confirmations).toBe(0);

    expect(briaClient.submitPayout).toHaveBeenCalledWith({
      walletName: 'test-wallet',
      payoutQueueName: 'test-queue',
      destination: { onchainAddress: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn' },
      satoshis: 100000,
      externalId: 'koya:conversion:KYA-TEST01',
      metadata: { referenceCode: 'KYA-TEST01', driver: 'dfns' },
    });
  });

  it('should build correct externalId from referenceCode', async () => {
    briaClient.submitPayout.mockResolvedValue({ id: 'bria-payout-002' });

    await provider.send({
      address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      amountSatoshis: BigInt(50000),
      referenceCode: 'KYA-ABCD1234',
    });

    expect(briaClient.submitPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'koya:conversion:KYA-ABCD1234',
      }),
    );
  });

  it('should return failure on Bria error', async () => {
    briaClient.submitPayout.mockRejectedValue(
      new Error('forbidden'),
    );

    const result = await provider.send({
      address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      amountSatoshis: BigInt(10000),
      referenceCode: 'KYA-FAIL01',
    });

    expect(result.success).toBe(false);
    expect(result.txHash).toBe('');
    expect(result.confirmations).toBe(0);
  });

  it('should return failure on network error', async () => {
    briaClient.submitPayout.mockRejectedValue(
      new Error('gRPC stream error'),
    );

    const result = await provider.send({
      address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      amountSatoshis: BigInt(20000),
      referenceCode: 'KYA-NET01',
    });

    expect(result.success).toBe(false);
  });
});
