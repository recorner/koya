import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MPESA_ADAPTER } from '../providers/mpesa-adapter.interface';
import type { MpesaAdapter } from '../providers/mpesa-adapter.interface';

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MPESA_ADAPTER) private readonly mpesaAdapter: MpesaAdapter,
  ) {}

  /**
   * Initiate an STK push for a conversion session
   */
  async initiateSTKPush(input: {
    conversionSessionId: string;
    phoneE164: string;
    amountKES: number;
    referenceCode: string;
  }) {
    const result = await this.mpesaAdapter.initiateSTKPush({
      phoneE164: input.phoneE164,
      amountKES: input.amountKES,
      accountReference: input.referenceCode,
      transactionDesc: `Koya conversion ${input.referenceCode}`,
    });

    if (!result.success) {
      throw new Error('STK push initiation failed');
    }

    // Create payment instruction record
    const instruction = await this.prisma.paymentInstruction.create({
      data: {
        conversionSessionId: input.conversionSessionId,
        provider: 'MPESA',
        instructionType: 'STK_PUSH',
        phoneE164: input.phoneE164,
        amountMinor: BigInt(Math.round(input.amountKES * 100)),
        currency: 'KES',
        externalReference: input.referenceCode,
        merchantRequestId: result.merchantRequestId,
        checkoutRequestId: result.checkoutRequestId,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `STK push initiated: ${result.checkoutRequestId} for session ${input.conversionSessionId}`,
    );

    return instruction;
  }

  /**
   * Handle M-Pesa callback — idempotent
   */
  async handleCallback(checkoutRequestId: string, resultCode: number, rawPayload: unknown) {
    // Find the payment instruction by checkoutRequestId
    const instruction = await this.prisma.paymentInstruction.findUnique({
      where: { checkoutRequestId },
    });

    if (!instruction) {
      this.logger.warn(`Callback for unknown checkoutRequestId: ${checkoutRequestId}`);
      throw new NotFoundException('Payment instruction not found');
    }

    // Idempotency: if already confirmed/failed, skip
    if (instruction.status === 'CONFIRMED' || instruction.status === 'FAILED') {
      this.logger.log(`Duplicate callback ignored for ${checkoutRequestId}`);
      return { sessionId: instruction.conversionSessionId, alreadyProcessed: true };
    }

    const newStatus = resultCode === 0 ? 'CONFIRMED' : 'FAILED';

    await this.prisma.paymentInstruction.update({
      where: { id: instruction.id },
      data: {
        status: newStatus,
        rawCallbackPayload: rawPayload as any,
      },
    });

    this.logger.log(
      `Payment ${checkoutRequestId} ${newStatus} (resultCode=${resultCode})`,
    );

    return {
      sessionId: instruction.conversionSessionId,
      status: newStatus,
      alreadyProcessed: false,
    };
  }

  /**
   * Confirm a payment by M-Pesa reference code entered manually by the user.
   * In mock mode, any 6+ char reference is accepted.
   * In production, this would query the M-Pesa API to verify the receipt.
   */
  async confirmByReference(
    conversionSessionId: string,
    mpesaReference: string,
  ): Promise<{ confirmed: boolean; reason?: string }> {
    const instruction = await this.prisma.paymentInstruction.findUnique({
      where: { conversionSessionId },
    });

    if (!instruction) {
      return { confirmed: false, reason: 'No payment instruction found for this session' };
    }

    if (instruction.status === 'CONFIRMED') {
      return { confirmed: true };
    }

    if (instruction.status === 'FAILED') {
      return { confirmed: false, reason: 'Payment was already marked as failed' };
    }

    // In mock mode, accept any valid-looking reference
    // In production: call Safaricom Transaction Status API to verify
    const isValid = mpesaReference.length >= 6;

    if (!isValid) {
      return { confirmed: false, reason: 'Invalid M-Pesa reference code' };
    }

    await this.prisma.paymentInstruction.update({
      where: { id: instruction.id },
      data: {
        status: 'CONFIRMED',
        mpesaReceiptNumber: mpesaReference,
      },
    });

    this.logger.log(
      `Payment confirmed manually via reference ${mpesaReference} for session ${conversionSessionId}`,
    );

    return { confirmed: true };
  }
}
