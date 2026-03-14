import { Controller, Post, Body, Logger } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import type { MpesaCallbackPayload } from '../providers/mpesa-adapter.interface';

@Controller('payments/mpesa')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly mpesaService: MpesaService) {}

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

    await this.mpesaService.handleCallback(
      stkCallback.CheckoutRequestID,
      stkCallback.ResultCode,
      payload,
    );

    // Trigger conversion advancement if payment confirmed
    // This is handled by the ConversionService via event-driven flow
    // For now, the status poll endpoint picks up the new state

    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }
}
