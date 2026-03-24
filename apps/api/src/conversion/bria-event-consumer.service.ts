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
import { PsbtSigningService } from './psbt-signing.service';
import { RedisCursorStore } from './redis-cursor.store';
import { BriaClientService, BriaEvent, BriaEventPayload } from '@koya/bria-adapter';
import { ConversionState } from '@koya/types';

const CURSOR_NAME = 'bria_event_consumer';

@Injectable()
export class BriaEventConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BriaEventConsumerService.name);
  private subscription: Subscription | null = null;
  private readonly driver: string;

  constructor(
    private readonly briaClient: BriaClientService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly psbtSigningService: PsbtSigningService,
    private readonly cursorStore: RedisCursorStore,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {
    this.driver = this.config.get<string>('BTC_DELIVERY_DRIVER', 'mock');
  }

  async onModuleInit() {
    // Subscribe to Bria events for both 'bria' and 'dfns' drivers
    // (dfns driver uses Bria for UTXO management + PSBT building)
    if (this.driver !== 'bria' && this.driver !== 'dfns') {
      this.logger.log('BTC_DELIVERY_DRIVER is not bria/dfns — skipping event subscription');
      return;
    }

    const cursor = await this.cursorStore.getCursor(CURSOR_NAME) ?? 0;
    this.logger.log(`Starting Bria event subscription (driver=${this.driver}, cursor=${cursor})`);
    // augment=true to get payout_info with batch_id
    const stream$ = this.briaClient.subscribeAll({ afterSequence: cursor, augment: true });

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

    try {
      await this.processEvent(payload, event);
    } finally {
      // Persist cursor after processing (even on failure, to avoid infinite retry loops)
      await this.cursorStore.setCursor(CURSOR_NAME, event.sequence);
    }
  }

  private async processEvent(payload: BriaEventPayload, event: BriaEvent): Promise<void> {
    switch (payload.type) {
      case 'payout_submitted':
        this.logger.debug(`Payout submitted: ${payload.data.id} seq=${event.sequence}`);
        break;

      case 'payout_committed':
        this.logger.debug(`Payout committed: ${payload.data.id} batch txId=${payload.data.txId}`);
        await this.handlePayoutCommitted(payload, event);
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

  /**
   * When driver=dfns, payout_committed means Bria built the batch with an unsigned PSBT.
   * We retrieve it, send to DFNS for signing, and submit the signed PSBT back to Bria.
   */
  private async handlePayoutCommitted(
    payload: Extract<BriaEventPayload, { type: 'payout_committed' }>,
    event: BriaEvent,
  ): Promise<void> {
    if (this.driver !== 'dfns') {
      return; // Only DFNS driver uses external PSBT signing
    }

    const payout = await this.findPayoutByProviderId(payload.data.id);
    if (!payout || !payout.externalId) {
      this.logger.debug(`No Koya payout for committed payout ${payload.data.id}, skipping PSBT signing`);
      return;
    }

    // Get batchId from augmented event data or from getPayout
    const augmentation = (event as unknown as Record<string, unknown>)['augmentation'] as
      | { payoutInfo?: { batchId?: string } }
      | undefined;
    let batchId = augmentation?.payoutInfo?.batchId;

    if (!batchId) {
      // Fallback: fetch payout info to get batchId
      const payoutInfo = await this.briaClient.getPayout({ id: payload.data.id });
      batchId = payoutInfo.batchId;
    }

    if (!batchId) {
      this.logger.error(`No batchId found for payout ${payload.data.id} — cannot sign PSBT`);
      return;
    }

    try {
      await this.psbtSigningService.handlePayoutCommitted(
        payload.data.id,
        payout.externalId,
        batchId,
      );
    } catch (err) {
      this.logger.error(
        `PSBT signing failed for payout ${payload.data.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
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

    // Update PSBT record if tracking
    if (payout.externalId) {
      await this.psbtSigningService.markSettled(payout.externalId, payload.data.txId).catch((err) => {
        this.logger.debug(`PSBT settled update skipped: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

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
