import { DfnsBtcDeliveryProvider } from '../dfns-btc-delivery.provider';
import { DfnsService } from '../../dfns/dfns.service';

describe('DfnsBtcDeliveryProvider', () => {
  let provider: DfnsBtcDeliveryProvider;
  let dfnsService: jest.Mocked<DfnsService>;

  beforeEach(() => {
    dfnsService = {
      requestCustodyMove: jest.fn(),
    } as unknown as jest.Mocked<DfnsService>;

    provider = new DfnsBtcDeliveryProvider(dfnsService);
  });

  it('should submit custody move with correct params', async () => {
    dfnsService.requestCustodyMove.mockResolvedValue({
      dfnsRequestId: 'dfns-req-001',
      status: 'PENDING',
    });

    const result = await provider.send({
      address: 'tb1qtest123',
      amountSatoshis: BigInt(100000),
      referenceCode: 'KYA-TEST01',
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBe('dfns-req-001');
    expect(result.confirmations).toBe(0);

    expect(dfnsService.requestCustodyMove).toHaveBeenCalledWith({
      externalId: 'koya:conversion:KYA-TEST01',
      destination: 'tb1qtest123',
      satoshis: 100000,
    });
  });

  it('should build correct externalId from referenceCode', async () => {
    dfnsService.requestCustodyMove.mockResolvedValue({
      dfnsRequestId: 'dfns-req-002',
      status: 'PENDING',
    });

    await provider.send({
      address: 'tb1qaddr',
      amountSatoshis: BigInt(50000),
      referenceCode: 'KYA-ABCD1234',
    });

    expect(dfnsService.requestCustodyMove).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'koya:conversion:KYA-ABCD1234',
      }),
    );
  });

  it('should handle existing request (idempotent)', async () => {
    dfnsService.requestCustodyMove.mockResolvedValue({
      dfnsRequestId: 'dfns-existing',
      status: 'PENDING',
    });

    const result = await provider.send({
      address: 'tb1qaddr',
      amountSatoshis: BigInt(75000),
      referenceCode: 'KYA-EXIST01',
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBe('dfns-existing');
  });

  it('should return failure on error', async () => {
    dfnsService.requestCustodyMove.mockRejectedValue(
      new Error('DFNS API error: 400 Bad Request'),
    );

    const result = await provider.send({
      address: 'tb1qbad',
      amountSatoshis: BigInt(10000),
      referenceCode: 'KYA-FAIL01',
    });

    expect(result.success).toBe(false);
    expect(result.txHash).toBe('');
    expect(result.confirmations).toBe(0);
  });

  it('should return failure on network error', async () => {
    dfnsService.requestCustodyMove.mockRejectedValue(
      new Error('fetch failed'),
    );

    const result = await provider.send({
      address: 'tb1qnet',
      amountSatoshis: BigInt(20000),
      referenceCode: 'KYA-NET01',
    });

    expect(result.success).toBe(false);
  });
});
