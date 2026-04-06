import { Controller, Post, Body, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MpesaService } from './mpesa.service';
import { ProcessedWebhookService } from '../webhooks/processed-webhook.service';
import { PrismaService } from '../prisma/prisma.service';
import type { MpesaCallbackPayload } from '../providers/mpesa-adapter.interface';
import { Prisma } from '@prisma/client';
import { WebhookThrottle } from '../security/throttle.decorators';

@Controller('payments/mpesa')
@WebhookThrottle()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly mpesaService: MpesaService,
    private readonly webhookService: ProcessedWebhookService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * POST /api/v1/payments/mpesa/callback
   * Handles M-Pesa STK push callback — idempotent via two layers:
   * 1. processed_webhooks table (INSERT ON CONFLICT DO NOTHING)
   * 2. PaymentInstruction status check (skip if already CONFIRMED/FAILED)
   */
  @Post('callback')
  async handleCallback(@Body() payload: MpesaCallbackPayload) {
    const { stkCallback } = payload.Body;
    const checkoutRequestId = stkCallback.CheckoutRequestID;

    this.logger.log(
      `M-Pesa callback: ${checkoutRequestId}, result=${stkCallback.ResultCode}`,
    );

    // Layer 1: Webhook-level dedup
    const isNew = await this.webhookService.markProcessed(
      'daraja',
      checkoutRequestId,
    );
    if (!isNew) {
      this.logger.log(`Duplicate Daraja callback ignored: ${checkoutRequestId}`);
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    // Record in daraja_requests for audit trail
    const amount = this.extractAmount(stkCallback);
    await this.prisma.darajaRequest.upsert({
      where: { checkoutRequestId },
      create: {
        externalId: checkoutRequestId,
        checkoutRequestId,
        amount: BigInt(Math.round(amount * 100)),
        status: stkCallback.ResultCode === 0 ? 'CONFIRMED' : 'FAILED',
        rawPayload: payload as unknown as Prisma.InputJsonValue,
      },
      update: {
        status: stkCallback.ResultCode === 0 ? 'CONFIRMED' : 'FAILED',
        rawPayload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    // Layer 2: Process through MpesaService (has its own idempotency)
    const result = await this.mpesaService.handleCallback(
      checkoutRequestId,
      stkCallback.ResultCode,
      payload,
    );

    // Extract and store M-Pesa receipt number from callback metadata
    if (result && result.status === 'CONFIRMED' && stkCallback.CallbackMetadata) {
      const receiptNumber = this.extractReceiptNumber(stkCallback);
      if (receiptNumber) {
        await this.mpesaService.updateReceiptNumber(
          checkoutRequestId,
          receiptNumber,
        );
      }
    }

    // Trigger conversion advancement if payment confirmed
    if (result && result.status === 'CONFIRMED' && !result.alreadyProcessed) {
      this.eventEmitter.emit('payment.confirmed', {
        sessionId: result.sessionId,
      });
    }

    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  private extractAmount(stkCallback: MpesaCallbackPayload['Body']['stkCallback']): number {
    const amountItem = stkCallback.CallbackMetadata?.Item?.find(
      (item) => item.Name === 'Amount',
    );
    return amountItem ? Number(amountItem.Value) : 0;
  }

  private extractReceiptNumber(stkCallback: MpesaCallbackPayload['Body']['stkCallback']): string | null {
    const receiptItem = stkCallback.CallbackMetadata?.Item?.find(
      (item) => item.Name === 'MpesaReceiptNumber',
    );
    return receiptItem ? String(receiptItem.Value) : null;
  }
}
