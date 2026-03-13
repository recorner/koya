import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuoteService } from './quote.service';
import { SessionService } from './session.service';
import { GuestProfileService } from '../kyc/guest-profile.service';
import { ComplianceService } from '../kyc/compliance.service';
import { GuestLimitService } from '../kyc/guest-limit.service';
import { MpesaService } from '../payments/mpesa.service';
import { RiskService } from '../risk/risk.service';
import { BTC_DELIVERY_PROVIDER } from '../providers/btc-delivery.interface';
import type { BtcDeliveryProvider } from '../providers/btc-delivery.interface';
import { getRoutePolicy } from './route-policy';
import { isValidBtcAddress } from '../common/validation.utils';
import { ConversionState } from '@koya/types';
import { formatMinorToDisplay } from '../common/validation.utils';

@Injectable()
export class ConversionService {
  private readonly logger = new Logger(ConversionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteService: QuoteService,
    private readonly sessionService: SessionService,
    private readonly guestProfileService: GuestProfileService,
    private readonly complianceService: ComplianceService,
    private readonly guestLimitService: GuestLimitService,
    private readonly mpesaService: MpesaService,
    private readonly riskService: RiskService,
    @Inject(BTC_DELIVERY_PROVIDER) private readonly btcDelivery: BtcDeliveryProvider,
  ) {}

  /**
   * Step 1: Generate a quote
   */
  async createQuote(input: {
    sourceAsset: string;
    targetAsset: string;
    sourceAmount: string;
    channel: string;
  }) {
    return this.quoteService.createQuote({
      sourceAsset: input.sourceAsset,
      targetAsset: input.targetAsset,
      sourceAmount: input.sourceAmount,
    });
  }

  /**
   * Step 2: Create a session from a confirmed quote
   */
  async createSession(input: { quoteId: string; channel: string }) {
    const quote = await this.quoteService.validateQuote(input.quoteId);
    await this.quoteService.confirmQuote(input.quoteId);

    const route = getRoutePolicy(quote.sourceAsset, quote.targetAsset);
    if (!route) {
      throw new BadRequestException('Route not supported');
    }

    const session = await this.sessionService.createSession({
      quoteId: input.quoteId,
      channel: input.channel,
      sourceAsset: quote.sourceAsset,
      targetAsset: quote.targetAsset,
      sourceAmountMinor: quote.sourceAmountMinor,
      quotedTargetAmountMinor: quote.targetAmountMinor,
      routePolicyKey: route.key,
      payinMethod: route.payinMethod,
      payoutMethod: route.payoutMethod,
    });

    // Move to identity pending
    await this.sessionService.transitionState(
      session.id,
      ConversionState.IDENTITY_PENDING,
      'session_created_awaiting_identity',
    );

    return {
      sessionId: session.id,
      currentState: ConversionState.IDENTITY_PENDING,
      referenceCode: session.referenceCode,
    };
  }

  /**
   * Step 3: Submit identity and run compliance
   */
  async submitIdentity(
    sessionId: string,
    input: {
      fullName: string;
      countryCode: string;
      documentType: 'NATIONAL_ID' | 'PASSPORT' | 'ALIEN_ID' | 'MILITARY_ID';
      documentNumber: string;
      phone: string;
      email?: string;
    },
  ) {
    const session = await this.sessionService.getSession(sessionId);

    if (session.currentState !== 'IDENTITY_PENDING') {
      throw new BadRequestException(
        `Cannot submit identity in state ${session.currentState}`,
      );
    }

    // Find or create guest profile
    const guestProfile = await this.guestProfileService.findOrCreate(input);

    // Link guest to session
    await this.prisma.conversionSession.update({
      where: { id: sessionId },
      data: { guestProfileId: guestProfile.id },
    });

    // Transition to compliance pending
    await this.sessionService.transitionState(
      sessionId,
      ConversionState.COMPLIANCE_PENDING,
      'identity_submitted',
      { guestProfileId: guestProfile.id },
    );

    // Run compliance checks
    const complianceResult = await this.complianceService.runChecks({
      fullName: input.fullName,
      countryCode: input.countryCode,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
    });

    if (!complianceResult.passed) {
      if (complianceResult.riskLevel === 'BLOCKED') {
        await this.sessionService.transitionState(
          sessionId,
          ConversionState.FAILED,
          'compliance_blocked',
          { reason: complianceResult.reason },
        );
      } else {
        await this.sessionService.transitionState(
          sessionId,
          ConversionState.MANUAL_REVIEW,
          'compliance_review_required',
          { reason: complianceResult.reason },
        );
      }

      return {
        guestRef: guestProfile.guestRef,
        currentState: session.currentState,
        compliancePassed: false,
        reason: complianceResult.reason,
      };
    }

    // Check guest limits
    await this.guestLimitService.checkLimits(
      guestProfile.id,
      session.sourceAmountMinor,
    );

    // Transition to payout details pending
    await this.sessionService.transitionState(
      sessionId,
      ConversionState.PAYOUT_DETAILS_PENDING,
      'compliance_passed',
    );

    return {
      guestRef: guestProfile.guestRef,
      currentState: ConversionState.PAYOUT_DETAILS_PENDING,
      compliancePassed: true,
    };
  }

  /**
   * Step 4: Submit payout details (BTC address)
   */
  async submitPayoutDetails(sessionId: string, btcAddress: string) {
    const session = await this.sessionService.getSession(sessionId);

    if (session.currentState !== 'PAYOUT_DETAILS_PENDING') {
      throw new BadRequestException(
        `Cannot submit payout details in state ${session.currentState}`,
      );
    }

    if (!isValidBtcAddress(btcAddress)) {
      throw new BadRequestException('Invalid BTC address');
    }

    // Create payout instruction
    await this.prisma.payoutInstruction.create({
      data: {
        conversionSessionId: sessionId,
        destinationType: 'BTC_ADDRESS',
        btcAddress,
        status: 'CREATED',
      },
    });

    // Transition to payment pending
    await this.sessionService.transitionState(
      sessionId,
      ConversionState.PAYMENT_PENDING,
      'payout_details_submitted',
      { btcAddress },
    );

    return {
      sessionId,
      currentState: ConversionState.PAYMENT_PENDING,
    };
  }

  /**
   * Step 5: Initiate M-Pesa STK push
   */
  async initiatePayment(sessionId: string) {
    const session = await this.sessionService.getSessionWithRelations(sessionId);

    if (session.currentState !== 'PAYMENT_PENDING') {
      throw new BadRequestException(
        `Cannot initiate payment in state ${session.currentState}`,
      );
    }

    if (!session.guestProfile) {
      throw new BadRequestException('Guest profile not linked');
    }

    // Amount in KES (major units) for STK push
    const amountKES = Number(session.sourceAmountMinor) / 100;

    const instruction = await this.mpesaService.initiateSTKPush({
      conversionSessionId: sessionId,
      phoneE164: session.guestProfile.phoneE164,
      amountKES,
      referenceCode: session.referenceCode,
    });

    this.logger.log(
      `Payment initiated for session ${sessionId}: ${instruction.checkoutRequestId}`,
    );

    return {
      sessionId,
      currentState: ConversionState.PAYMENT_PENDING,
      checkoutRequestId: instruction.checkoutRequestId,
      phone: session.guestProfile.phoneE164,
    };
  }

  /**
   * Step 6: Process payment confirmation (called after M-Pesa callback)
   */
  async processPaymentConfirmation(sessionId: string) {
    const session = await this.sessionService.getSession(sessionId);

    if (session.currentState !== 'PAYMENT_PENDING') {
      return; // Already processed
    }

    // Check payment instruction status
    const instruction = await this.prisma.paymentInstruction.findUnique({
      where: { conversionSessionId: sessionId },
    });

    if (!instruction || instruction.status !== 'CONFIRMED') {
      return;
    }

    // Advance: PAYMENT_CONFIRMED → EXECUTION_PENDING → DELIVERY_PENDING → COMPLETED
    await this.sessionService.transitionState(
      sessionId,
      ConversionState.PAYMENT_CONFIRMED,
      'mpesa_payment_confirmed',
    );

    await this.sessionService.transitionState(
      sessionId,
      ConversionState.EXECUTION_PENDING,
      'executing_conversion',
    );

    // Mock execution — in production this would hit a real exchange
    await this.sessionService.transitionState(
      sessionId,
      ConversionState.DELIVERY_PENDING,
      'conversion_executed',
    );

    // Mock BTC delivery
    const payout = await this.prisma.payoutInstruction.findUnique({
      where: { conversionSessionId: sessionId },
    });

    if (payout) {
      const deliveryResult = await this.btcDelivery.send({
        address: payout.btcAddress,
        amountSatoshis: session.quotedTargetAmountMinor ?? BigInt(0),
        referenceCode: session.referenceCode,
      });

      await this.prisma.payoutInstruction.update({
        where: { id: payout.id },
        data: {
          status: deliveryResult.success ? 'CONFIRMED' : 'FAILED',
          txHash: deliveryResult.txHash,
          amountMinor: session.quotedTargetAmountMinor,
        },
      });

      if (deliveryResult.success) {
        await this.sessionService.transitionState(
          sessionId,
          ConversionState.COMPLETED,
          'btc_delivered',
          { txHash: deliveryResult.txHash },
        );
      } else {
        await this.sessionService.transitionState(
          sessionId,
          ConversionState.FAILED,
          'btc_delivery_failed',
        );
      }
    }
  }

  /**
   * Get session status (safe for UI)
   */
  async getStatus(sessionId: string) {
    const session = await this.sessionService.getSessionWithRelations(sessionId);

    // Check if payment has been confirmed and advance if needed
    if (session.currentState === 'PAYMENT_PENDING') {
      await this.processPaymentConfirmation(sessionId);
      // Re-fetch after potential advancement
      const updated = await this.sessionService.getSessionWithRelations(sessionId);
      return this.formatStatus(updated);
    }

    return this.formatStatus(session);
  }

  private formatStatus(session: any) {
    const sourceDecimals = session.sourceAsset === 'BTC' ? 8 : 2;
    const targetDecimals = session.targetAsset === 'BTC' ? 8 : 2;

    return {
      sessionId: session.id,
      currentState: session.currentState,
      referenceCode: session.referenceCode,
      sourceAsset: session.sourceAsset,
      targetAsset: session.targetAsset,
      sourceAmount: formatMinorToDisplay(session.sourceAmountMinor, sourceDecimals),
      targetAmount: session.quotedTargetAmountMinor
        ? formatMinorToDisplay(session.quotedTargetAmountMinor, targetDecimals)
        : null,
      guestRef: session.guestProfile?.guestRef ?? null,
      txHash: session.payoutInstruction?.txHash ?? null,
      createdAt: session.createdAt.toISOString(),
    };
  }
}
