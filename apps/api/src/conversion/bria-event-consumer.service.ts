import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Subscription } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';
import { BriaClientService, BriaEvent, BriaEventPayload } from '@koya/bria-adapter';
import { ConversionState } from '@koya/types';

@Injectable()
export class BriaEventConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BriaEventConsumerService.name);
  private subscription: Subscription | null = null;
  private readonly driver: string;

  constructor(
    private readonly briaClient: BriaClientService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {
    this.driver = this.config.get<string>('BTC_DELIVERY_DRIVER', 'mock');
  }

  onModuleInit() {
    if (this.driver !== 'bria') {
      this.logger.log('BTC_DELIVERY_DRIVER is not bria — skipping event subscription');
      return;
    }

    this.logger.log('Starting Bria event subscription');
    const stream$ = this.briaClient.subscribeAll({ afterSequence: 0 });

    this.subscription = stream$.subscribe({
      next: (event: BriaEvent) => {
        this.handleEvent(event).catch((err) => {
          this.logger.error(`Error handling event seq=${event.sequence}`, err);
        });
      },
      error: (err) => {
        this.logger.error('Bria event stream error — will not auto-reconnect', err);
      },
    });
  }

  onModuleDestroy() {
    if (this.subscription) {
      this.logger.log('Unsubscribing from Bria event stream');
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  private async handleEvent(event: BriaEvent): Promise<void> {
    const { payload } = event;

    switch (payload.type) {
      case 'payout_submitted':
        this.logger.debug(`Payout submitted: ${payload.data.id} seq=${event.sequence}`);
        break;

      case 'payout_committed':
        this.logger.debug(`Payout committed: ${payload.data.id} batch txId=${payload.data.txId}`);
        break;

      case 'payout_broadcast':
        await this.handlePayoutBroadcast(payload);
        break;

      case 'payout_settled':
        await this.handlePayoutSettled(payload);
        break;

      case 'payout_cancelled':
        await this.handlePayoutCancelled(payload);
        break;

      default:
        // UTXO events and others — log only
        this.logger.debug(`Bria event: ${payload.type} seq=${event.sequence}`);
        break;
    }
  }

  private async handlePayoutBroadcast(payload: Extract<BriaEventPayload, { type: 'payout_broadcast' }>) {
    const payout = await this.findPayoutByProviderId(payload.data.id);
    if (!payout) return;

    this.logger.log(`Payout broadcast: ${payload.data.id} txId=${payload.data.txId}`);

    await this.prisma.payoutInstruction.update({
      where: { id: payout.id },
      data: { txHash: payload.data.txId },
    });
  }

  private async handlePayoutSettled(payload: Extract<BriaEventPayload, { type: 'payout_settled' }>) {
    const payout = await this.findPayoutByProviderId(payload.data.id);
    if (!payout) return;

    this.logger.log(`Payout settled: ${payload.data.id} txId=${payload.data.txId}`);

    // Idempotent: skip if already confirmed
    if (payout.status === 'CONFIRMED') {
      this.logger.debug(`Payout ${payout.id} already CONFIRMED, skipping`);
      return;
    }

    await this.prisma.payoutInstruction.update({
      where: { id: payout.id },
      data: {
        status: 'CONFIRMED',
        txHash: payload.data.txId,
      },
    });

    // Advance session to COMPLETED if still in DELIVERY_PENDING
    const session = await this.prisma.conversionSession.findUnique({
      where: { id: payout.conversionSessionId },
    });

    if (session && session.currentState === 'DELIVERY_PENDING') {
      await this.sessionService.transitionState(
        session.id,
        ConversionState.COMPLETED,
        'btc_settled_onchain',
        { txId: payload.data.txId, briaPayoutId: payload.data.id },
      );

      this.eventEmitter.emit('conversion.completed', {
        sessionId: session.id,
        channel: session.channel,
      });
    }
  }

  private async handlePayoutCancelled(payload: Extract<BriaEventPayload, { type: 'payout_cancelled' }>) {
    const payout = await this.findPayoutByProviderId(payload.data.id);
    if (!payout) return;

    this.logger.warn(`Payout cancelled by Bria: ${payload.data.id}`);

    await this.prisma.payoutInstruction.update({
      where: { id: payout.id },
      data: { status: 'FAILED' },
    });

    const session = await this.prisma.conversionSession.findUnique({
      where: { id: payout.conversionSessionId },
    });

    if (session && session.currentState === 'DELIVERY_PENDING') {
      await this.sessionService.transitionState(
        session.id,
        ConversionState.FAILED,
        'btc_payout_cancelled_by_provider',
        { briaPayoutId: payload.data.id },
      );
    }
  }

  private async findPayoutByProviderId(providerPayoutId: string) {
    const payout = await this.prisma.payoutInstruction.findFirst({
      where: { providerPayoutId },
    });

    if (!payout) {
      this.logger.debug(`No payout found for providerPayoutId=${providerPayoutId}, skipping`);
      return null;
    }

    return payout;
  }
}
