import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import {
  BTC_BACKEND_PROVIDER,
  BtcBackendProvider,
} from '../providers/btc-backend.interface';
import { SessionService } from './session.service';
import { ConversionState } from '@koya/types';

@Injectable()
export class BtcPayoutDispatchRetryService {
  private readonly logger = new Logger(BtcPayoutDispatchRetryService.name);
  private readonly enabled: boolean;
  private readonly driver: string;
  private readonly maxAttempts: number;
  private readonly pollMs: number;
  private processing = false;
  private lastTickAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sessionService: SessionService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(BTC_BACKEND_PROVIDER) private readonly btcBackend: BtcBackendProvider,
  ) {
    this.driver = this.config.get<string>('BTC_DELIVERY_DRIVER', 'mock');
    this.enabled = this.driver !== 'mock';
    this.maxAttempts = Number(this.config.get<string>('BTC_PAYOUT_RETRY_MAX_ATTEMPTS', '5'));
    this.pollMs = Number(this.config.get<string>('BTC_PAYOUT_RETRY_POLL_MS', '5000'));
  }

  @Interval(1000)
  async tick() {
    if (!this.enabled || this.processing) return;
    if (Date.now() - this.lastTickAt < this.pollMs) return;
    this.lastTickAt = Date.now();

    this.processing = true;
    try {
      const due = await this.prisma.payoutInstruction.findMany({
        where: {
          status: 'PENDING_DISPATCH',
          nextDispatchAt: {
            lte: new Date(),
          },
        },
        take: 25,
        orderBy: {
          nextDispatchAt: 'asc',
        },
        include: {
          session: true,
        },
      });

      if (due.length === 0) return;

      for (const payout of due) {
        await this.retryOne(payout);
      }
    } finally {
      this.processing = false;
    }
  }

  private async retryOne(payout: {
    id: string;
    conversionSessionId: string;
    btcAddress: string;
    dispatchAttempts: number;
    status: string;
    session: {
      id: string;
      referenceCode: string;
      quotedTargetAmountMinor: bigint | null;
      currentState: string;
      channel: string;
    };
  }) {
    if (payout.session.currentState !== 'DELIVERY_PENDING') {
      this.logger.warn(
        `Skipping payout retry ${payout.id}: session state is ${payout.session.currentState}`,
      );
      return;
    }

    const externalId = `koya:conversion:${payout.session.referenceCode}`;

    try {
      const result = await this.btcBackend.submitPayout({
        address: payout.btcAddress,
        amountSatoshis: payout.session.quotedTargetAmountMinor ?? BigInt(0),
        referenceCode: payout.session.referenceCode,
      });

      if (this.driver === 'bria' || this.driver === 'dfns') {
        await this.prisma.payoutInstruction.update({
          where: { id: payout.id },
          data: {
            externalId,
            providerPayoutId: result.providerPayoutId,
            nextDispatchAt: null,
            lastDispatchError: null,
            status: 'PENDING',
          },
        });

        this.logger.log(`Recovered payout dispatch ${payout.id} -> provider ${result.providerPayoutId}`);
        return;
      }

      await this.prisma.payoutInstruction.update({
        where: { id: payout.id },
        data: {
          externalId,
          providerPayoutId: result.providerPayoutId,
          txHash: result.txId ?? result.providerPayoutId,
          nextDispatchAt: null,
          lastDispatchError: null,
          status: 'CONFIRMED',
        },
      });

      await this.sessionService.transitionState(
        payout.session.id,
        ConversionState.COMPLETED,
        'btc_delivery_retry_succeeded',
        { txHash: result.txId ?? result.providerPayoutId },
      );

      this.eventEmitter.emit('conversion.completed', {
        sessionId: payout.session.id,
        channel: payout.session.channel,
      });
    } catch (error) {
      const classification = this.btcBackend.classifyError(error);
      const nextAttempt = (payout.dispatchAttempts ?? 0) + 1;

      if (!classification.retryable || nextAttempt >= this.maxAttempts) {
        await this.prisma.payoutInstruction.update({
          where: { id: payout.id },
          data: {
            externalId,
            dispatchAttempts: nextAttempt,
            nextDispatchAt: null,
            lastDispatchError: classification.reason,
            status: 'FAILED',
          },
        });

        await this.sessionService.transitionState(
          payout.session.id,
          ConversionState.MANUAL_REVIEW,
          'btc_delivery_retry_exhausted',
          {
            reason: classification.reason,
            attempts: nextAttempt,
          },
        );
        return;
      }

      const suggestedDelayMs = classification.suggestedDelayMs ?? 2000;
      const nextDelayMs = Math.min(60_000, suggestedDelayMs * Math.pow(2, Math.max(0, nextAttempt - 1)));

      await this.prisma.payoutInstruction.update({
        where: { id: payout.id },
        data: {
          externalId,
          dispatchAttempts: nextAttempt,
          nextDispatchAt: new Date(Date.now() + nextDelayMs),
          lastDispatchError: classification.reason,
          status: 'PENDING_DISPATCH',
        },
      });

      this.logger.warn(
        `Retry failed for payout ${payout.id}; scheduling attempt ${nextAttempt}/${this.maxAttempts} in ${nextDelayMs}ms`,
      );
    }
  }
}
