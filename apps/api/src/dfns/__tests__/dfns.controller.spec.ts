import { Test } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { DfnsController } from '../dfns.controller';
import { DfnsService } from '../dfns.service';
import { ProcessedWebhookService } from '../../webhooks/processed-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DfnsController', () => {
  let controller: DfnsController;
  let dfnsService: jest.Mocked<DfnsService>;
  let webhookService: jest.Mocked<ProcessedWebhookService>;
  let prisma: jest.Mocked<PrismaService>;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    dfnsService = {
      verifyWebhookSignature: jest.fn(),
      getRequestByExternalId: jest.fn(),
      updateRequestStatus: jest.fn(),
    } as unknown as jest.Mocked<DfnsService>;

    webhookService = {
      markProcessed: jest.fn(),
    } as unknown as jest.Mocked<ProcessedWebhookService>;

    prisma = {
      payoutInstruction: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      controllers: [DfnsController],
      providers: [
        { provide: DfnsService, useValue: dfnsService },
        { provide: ProcessedWebhookService, useValue: webhookService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    controller = module.get(DfnsController);
    eventEmitter = module.get(EventEmitter2);
  });

  const mockPayload = {
    id: 'dfns-wh-001',
    kind: 'transfer',
    status: 'Executed',
    externalId: 'koya:conversion:KYA-TEST01',
    txHash: 'tx-onchain-001',
  };

  const mockReq = {
    body: JSON.stringify(mockPayload),
  } as { body: string };

  it('should reject invalid signature', async () => {
    dfnsService.verifyWebhookSignature.mockReturnValue(false);

    await expect(
      controller.handleWebhook(mockPayload, 'bad-sig', mockReq as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should ignore webhook without externalId', async () => {
    dfnsService.verifyWebhookSignature.mockReturnValue(true);
    const noExtId = { ...mockPayload, externalId: undefined };

    const result = await controller.handleWebhook(
      noExtId,
      'valid-sig',
      { body: JSON.stringify(noExtId) } as never,
    );

    expect(result).toEqual({ status: 'ignored', reason: 'no externalId' });
  });

  it('should return already_processed for duplicate webhooks', async () => {
    dfnsService.verifyWebhookSignature.mockReturnValue(true);
    webhookService.markProcessed.mockResolvedValue(false);

    const result = await controller.handleWebhook(
      mockPayload,
      'valid-sig',
      mockReq as never,
    );

    expect(result).toEqual({ status: 'already_processed' });
  });

  it('should throw 404 for unknown externalId', async () => {
    dfnsService.verifyWebhookSignature.mockReturnValue(true);
    webhookService.markProcessed.mockResolvedValue(true);
    dfnsService.getRequestByExternalId.mockResolvedValue(null);

    await expect(
      controller.handleWebhook(mockPayload, 'valid-sig', mockReq as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('should process successful webhook and emit delivery.confirmed', async () => {
    dfnsService.verifyWebhookSignature.mockReturnValue(true);
    webhookService.markProcessed.mockResolvedValue(true);
    dfnsService.getRequestByExternalId.mockResolvedValue({
      id: 'db-001',
      externalId: 'koya:conversion:KYA-TEST01',
      dfnsRequestId: 'dfns-req-001',
      dfnsTxId: null,
      status: 'PENDING',
      rawPayload: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.payoutInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: 'payout-001',
      conversionSessionId: 'session-001',
      status: 'PENDING',
      externalId: 'koya:conversion:KYA-TEST01',
    });
    (prisma.payoutInstruction.update as jest.Mock).mockResolvedValue({});

    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    const result = await controller.handleWebhook(
      mockPayload,
      'valid-sig',
      mockReq as never,
    );

    expect(result).toEqual({ status: 'processed' });
    expect(dfnsService.updateRequestStatus).toHaveBeenCalledWith(
      'koya:conversion:KYA-TEST01',
      'COMPLETED',
      'tx-onchain-001',
    );
    expect(prisma.payoutInstruction.update).toHaveBeenCalledWith({
      where: { id: 'payout-001' },
      data: {
        status: 'CONFIRMED',
        providerPayoutId: 'dfns-wh-001',
        txHash: 'tx-onchain-001',
      },
    });
    expect(emitSpy).toHaveBeenCalledWith('delivery.confirmed', {
      sessionId: 'session-001',
      txId: 'tx-onchain-001',
      provider: 'dfns',
      providerRequestId: 'dfns-wh-001',
    });
  });

  it('should skip already confirmed payouts (idempotent)', async () => {
    dfnsService.verifyWebhookSignature.mockReturnValue(true);
    webhookService.markProcessed.mockResolvedValue(true);
    dfnsService.getRequestByExternalId.mockResolvedValue({
      id: 'db-002',
      externalId: 'koya:conversion:KYA-DONE',
      dfnsRequestId: 'dfns-req-002',
      dfnsTxId: 'tx-already',
      status: 'COMPLETED',
      rawPayload: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.payoutInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: 'payout-002',
      conversionSessionId: 'session-002',
      status: 'CONFIRMED',
      externalId: 'koya:conversion:KYA-DONE',
    });

    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    const payload = {
      ...mockPayload,
      externalId: 'koya:conversion:KYA-DONE',
    };
    await controller.handleWebhook(
      payload,
      'valid-sig',
      { body: JSON.stringify(payload) } as never,
    );

    // Should NOT emit delivery.confirmed since already CONFIRMED
    expect(emitSpy).not.toHaveBeenCalledWith(
      'delivery.confirmed',
      expect.anything(),
    );
  });

  it('should process failed webhook and emit delivery.failed', async () => {
    dfnsService.verifyWebhookSignature.mockReturnValue(true);
    webhookService.markProcessed.mockResolvedValue(true);
    dfnsService.getRequestByExternalId.mockResolvedValue({
      id: 'db-003',
      externalId: 'koya:conversion:KYA-FAIL',
      dfnsRequestId: 'dfns-req-003',
      dfnsTxId: null,
      status: 'PENDING',
      rawPayload: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.payoutInstruction.findUnique as jest.Mock).mockResolvedValue({
      id: 'payout-003',
      conversionSessionId: 'session-003',
      status: 'PENDING',
      externalId: 'koya:conversion:KYA-FAIL',
    });
    (prisma.payoutInstruction.update as jest.Mock).mockResolvedValue({});

    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    const failPayload = {
      ...mockPayload,
      status: 'Failed',
      externalId: 'koya:conversion:KYA-FAIL',
      txHash: undefined,
    };

    await controller.handleWebhook(
      failPayload,
      'valid-sig',
      { body: JSON.stringify(failPayload) } as never,
    );

    expect(dfnsService.updateRequestStatus).toHaveBeenCalledWith(
      'koya:conversion:KYA-FAIL',
      'FAILED',
    );
    expect(emitSpy).toHaveBeenCalledWith('delivery.failed', {
      sessionId: 'session-003',
      provider: 'dfns',
      reason: 'Failed',
    });
  });
});
