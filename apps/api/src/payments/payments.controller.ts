import { Controller, Post, Body, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MpesaService } from './mpesa.service';
import type { MpesaCallbackPayload } from '../providers/mpesa-adapter.interface';

@Controller('payments/mpesa')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly mpesaService: MpesaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * POST /api/v1/payments/mpesa/callback
   * Handles M-Pesa STK push callback — idempotent
   */
  @Post('callback')
  async handleCallback(@Body() payload: MpesaCallbackPayload) {
    const { stkCallback } = payload.Body;

    this.logger.log(
      `M-Pesa callback: ${stkCallback.CheckoutRequestID}, result=${stkCallback.ResultCode}`,
    );

    const result = await this.mpesaService.handleCallback(
      stkCallback.CheckoutRequestID,
      stkCallback.ResultCode,
      payload,
    );

    // Trigger conversion advancement if payment confirmed
    if (result && result.status === 'CONFIRMED' && !result.alreadyProcessed) {
      this.eventEmitter.emit('payment.confirmed', {
        sessionId: result.sessionId,
      });
    }

    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}
