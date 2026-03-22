import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
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
import { SWAP_PROVIDER } from '../providers/swap-provider.interface';
import type { SwapProvider } from '../providers/swap-provider.interface';
import { getRoutePolicy } from './route-policy';
import { isValidBtcAddress } from '../common/validation.utils';
import { ConversionState } from '@koya/types';
import { formatMinorToDisplay } from '../common/validation.utils';

/** States at or past payment initiation — expiry no longer enforced */
const POST_PAYMENT_STATES = new Set<string>([
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'EXECUTION_PENDING',
  'DELIVERY_PENDING',
  'COMPLETED',
  'FAILED',
  'EXPIRED',
  'MANUAL_REVIEW',
]);

@Injectable()
export class ConversionService {
  private readonly logger = new Logger(ConversionService.name);
  private readonly btcDeliveryDriver: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteService: QuoteService,
    private readonly sessionService: SessionService,
    private readonly guestProfileService: GuestProfileService,
    private readonly complianceService: ComplianceService,
    private readonly guestLimitService: GuestLimitService,
    private readonly mpesaService: MpesaService,
    private readonly riskService: RiskService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
    @Inject(BTC_DELIVERY_PROVIDER) private readonly btcDelivery: BtcDeliveryProvider,
    @Inject(SWAP_PROVIDER) private readonly swapProvider: SwapProvider,
  ) {
    this.btcDeliveryDriver = this.config.get<string>('BTC_DELIVERY_DRIVER', 'mock');
  }

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
   * Check if a session has expired. Only enforced for pre-payment states.
   * Once payment is initiated (PAYMENT_PENDING+), expiry is paused.
   */
  private async ensureNotExpired(session: { id: string; expiresAt: Date | null; currentState: string }) {
    if (!session.expiresAt) return;
    if (POST_PAYMENT_STATES.has(session.currentState)) return;
    if (new Date() > session.expiresAt) {
      await this.sessionService.transitionState(
        session.id,
        ConversionState.EXPIRED,
        'order_ttl_expired',
      );
      throw new BadRequestException(
        'This order has expired. Please start a new conversion.',
      );
    }
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
    await this.ensureNotExpired(session);

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
    await this.ensureNotExpired(session);

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
    await this.ensureNotExpired(session);

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

    // Execute swap via provider
    const quote = await this.prisma.conversionQuote.findUnique({
      where: { id: session.quoteId ?? '' },
    });

    const swapResult = await this.swapProvider.executeSwap({
      sourceAsset: session.sourceAsset,
      targetAsset: session.targetAsset,
      sourceAmountMinor: session.sourceAmountMinor,
      rate: quote?.rate?.toString() ?? '0',
      referenceCode: session.referenceCode,
    });

    if (!swapResult.success) {
      await this.sessionService.transitionState(
        sessionId,
        ConversionState.FAILED,
        'swap_execution_failed',
        { reason: swapResult.reason },
      );
      return;
    }

    this.logger.log(
      `Swap executed: ${swapResult.executionId} settled at ${swapResult.settledRate}`,
    );

    await this.sessionService.transitionState(
      sessionId,
      ConversionState.DELIVERY_PENDING,
      'conversion_executed',
      { executionId: swapResult.executionId, settledRate: swapResult.settledRate },
    );

    // BTC delivery via configured provider (mock or bria)
    const payout = await this.prisma.payoutInstruction.findUnique({
      where: { conversionSessionId: sessionId },
    });

    if (payout) {
      const externalId = `koya:conversion:${session.referenceCode}`;
      const deliveryResult = await this.btcDelivery.send({
        address: payout.btcAddress,
        amountSatoshis: session.quotedTargetAmountMinor ?? BigInt(0),
        referenceCode: session.referenceCode,
      });

      if (!deliveryResult.success) {
        await this.prisma.payoutInstruction.update({
          where: { id: payout.id },
          data: { externalId, status: 'FAILED', amountMinor: session.quotedTargetAmountMinor },
        });
        await this.sessionService.transitionState(
          sessionId,
          ConversionState.FAILED,
          'btc_delivery_failed',
        );
        return;
      }

      if (this.btcDeliveryDriver === 'bria' || this.btcDeliveryDriver === 'dfns') {
        // Async path: payout submitted but not yet on-chain.
        // Store provider payout ID, stay in DELIVERY_PENDING.
        // BriaEventConsumerService (bria) or DfnsController webhook (dfns) will advance to COMPLETED.
        await this.prisma.payoutInstruction.update({
          where: { id: payout.id },
          data: {
            externalId,
            providerPayoutId: deliveryResult.txHash || null,
            amountMinor: session.quotedTargetAmountMinor,
            status: 'PENDING',
          },
        });

        this.logger.log(
          `Payout submitted for ${sessionId}, awaiting on-chain confirmation via event consumer`,
        );
      } else {
        // Mock / instant-complete path
        await this.prisma.payoutInstruction.update({
          where: { id: payout.id },
          data: {
            externalId,
            txHash: deliveryResult.txHash,
            amountMinor: session.quotedTargetAmountMinor,
            status: 'CONFIRMED',
          },
        });

        await this.sessionService.transitionState(
          sessionId,
          ConversionState.COMPLETED,
          'btc_delivered',
          { txHash: deliveryResult.txHash },
        );

        this.eventEmitter.emit('conversion.completed', {
          sessionId,
          channel: session.channel,
        });
      }
    }
  }

  /**
   * Handle payment.confirmed event from M-Pesa callback
   */
  @OnEvent('payment.confirmed')
  async onPaymentConfirmed(event: { sessionId: string }): Promise<void> {
    this.logger.log(`Payment confirmed event for session ${event.sessionId}`);
    await this.processPaymentConfirmation(event.sessionId);
  }

  /**
   * Handle delivery.confirmed event from DFNS webhook (or any async delivery provider)
   */
  @OnEvent('delivery.confirmed')
  async onDeliveryConfirmed(event: {
    sessionId: string;
    txId: string;
    provider: string;
    providerRequestId: string;
  }): Promise<void> {
    this.logger.log(
      `Delivery confirmed event for session ${event.sessionId} via ${event.provider}`,
    );

    const session = await this.sessionService.getSession(event.sessionId);
    if (session.currentState !== 'DELIVERY_PENDING') {
      this.logger.log(
        `Session ${event.sessionId} not in DELIVERY_PENDING (${session.currentState}), skipping`,
      );
      return;
    }

    await this.sessionService.transitionState(
      event.sessionId,
      ConversionState.COMPLETED,
      `${event.provider}_delivery_confirmed`,
      { txId: event.txId, providerRequestId: event.providerRequestId },
    );

    this.eventEmitter.emit('conversion.completed', {
      sessionId: event.sessionId,
      channel: session.channel,
    });
  }

  /**
   * Handle delivery.failed event from DFNS webhook (or any async delivery provider)
   */
  @OnEvent('delivery.failed')
  async onDeliveryFailed(event: {
    sessionId: string;
    provider: string;
    reason: string;
  }): Promise<void> {
    this.logger.warn(
      `Delivery failed event for session ${event.sessionId} via ${event.provider}: ${event.reason}`,
    );

    const session = await this.sessionService.getSession(event.sessionId);
    if (session.currentState !== 'DELIVERY_PENDING') {
      return;
    }

    await this.sessionService.transitionState(
      event.sessionId,
      ConversionState.FAILED,
      `${event.provider}_delivery_failed`,
      { reason: event.reason },
    );
  }

  /**
   * Confirm payment by manual M-Pesa reference
   */
  async confirmByReference(sessionId: string, mpesaReference: string) {
    const session = await this.sessionService.getSession(sessionId);
    await this.ensureNotExpired(session);

    if (session.currentState !== 'PAYMENT_PENDING') {
      throw new BadRequestException(
        `Cannot confirm reference in state ${session.currentState}`,
      );
    }

    const result = await this.mpesaService.confirmByReference(
      sessionId,
      mpesaReference,
    );

    if (result.confirmed) {
      // Trigger the same post-payment flow
      await this.processPaymentConfirmation(sessionId);
    }

    return result;
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

  /**
   * Look up a session by its user-facing reference code and return status
   */
  async getStatusByReference(referenceCode: string) {
    const session = await this.prisma.conversionSession.findUnique({
      where: { referenceCode },
      include: {
        guestProfile: true,
        quote: true,
        paymentInstruction: true,
        payoutInstruction: true,
      },
    });

    if (!session) {
      throw new BadRequestException(`Order ${referenceCode} not found`);
    }

    return this.formatStatus(session);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      expiresAt: session.expiresAt?.toISOString() ?? null,
    };
  }
}
