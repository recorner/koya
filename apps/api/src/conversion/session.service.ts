import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RiskService } from '../risk/risk.service';
import { ConversionState } from '@koya/types';
import { Prisma, ConversionState as PrismaConversionState, Channel as PrismaChannel } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly riskService: RiskService,
  ) {}

  /**
   * Create a new conversion session from a confirmed quote
   */
  async createSession(input: {
    quoteId: string;
    channel: string;
    sourceAsset: string;
    targetAsset: string;
    sourceAmountMinor: bigint;
    quotedTargetAmountMinor: bigint;
    routePolicyKey: string;
    payinMethod: string;
    payoutMethod: string;
  }) {
    const referenceCode = `KYA-${uuidv4().slice(0, 8).toUpperCase()}`;

    const ORDER_TTL_MS = 20 * 60 * 1000; // 20 minutes

    const session = await this.prisma.conversionSession.create({
      data: {
        channel: input.channel as PrismaChannel,
        currentState: 'QUOTE_CONFIRMED',
        status: 'ACTIVE',
        sourceAsset: input.sourceAsset,
        targetAsset: input.targetAsset,
        sourceAmountMinor: input.sourceAmountMinor,
        quotedTargetAmountMinor: input.quotedTargetAmountMinor,
        quoteId: input.quoteId,
        routePolicyKey: input.routePolicyKey,
        payinMethod: input.payinMethod,
        payoutMethod: input.payoutMethod,
        referenceCode,
        expiresAt: new Date(Date.now() + ORDER_TTL_MS),
      },
    });

    // Record initial state event
    await this.recordStateEvent(session.id, null, 'QUOTE_CONFIRMED', 'session_created');

    this.logger.log(`Session created: ${session.id} | ref=${referenceCode}`);

    return session;
  }

  /**
   * Transition a session to a new state
   */
  async transitionState(
    sessionId: string,
    targetState: ConversionState,
    trigger: string,
    metadata?: Record<string, unknown>,
  ) {
    const session = await this.getSession(sessionId);

    // Validate transition
    this.riskService.validateTransition(
      session.currentState as ConversionState,
      targetState,
    );

    const updated = await this.prisma.conversionSession.update({
      where: { id: sessionId },
      data: {
        currentState: targetState as string as PrismaConversionState,
        status: this.deriveSessionStatus(targetState),
      },
    });

    await this.recordStateEvent(
      sessionId,
      session.currentState,
      targetState as string,
      trigger,
      metadata,
    );

    this.logger.log(
      `Session ${sessionId}: ${session.currentState} → ${targetState} [${trigger}]`,
    );

    return updated;
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.conversionSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return session;
  }

  async getSessionWithRelations(sessionId: string) {
    const session = await this.prisma.conversionSession.findUnique({
      where: { id: sessionId },
      include: {
        guestProfile: true,
        quote: true,
        paymentInstruction: true,
        payoutInstruction: true,
      },
    });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return session;
  }

  private async recordStateEvent(
    sessionId: string,
    fromState: string | null,
    toState: string,
    trigger: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.conversionStateEvent.create({
      data: {
        conversionSessionId: sessionId,
        fromState: fromState as string as PrismaConversionState | null,
        toState: toState as string as PrismaConversionState,
        trigger,
        ...(metadata ? { metadataJson: metadata as Prisma.InputJsonValue } : {}),
      },
    });
  }

  private deriveSessionStatus(
    state: ConversionState,
  ): 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'EXPIRED' {
    switch (state) {
      case ConversionState.COMPLETED:
        return 'COMPLETED';
      case ConversionState.FAILED:
        return 'FAILED';
      case ConversionState.EXPIRED:
        return 'EXPIRED';
      default:
        return 'ACTIVE';
    }
  }
}
