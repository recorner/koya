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

interface BriaStreamHealthStatus {
  enabled: boolean;
  driver: string;
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempt: number;
  committedCursor: number;
  lastEventSequence: number | null;
  lastEventAt: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastError: string | null;
  nextRetryDelayMs: number | null;
}

@Injectable()
export class BriaEventConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BriaEventConsumerService.name);
  private subscription: Subscription | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private processingQueue: Promise<void> = Promise.resolve();
  private shuttingDown = false;
  private committedCursor = 0;

  private readonly driver: string;
  private readonly enabled: boolean;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;
  private readonly reconnectJitterMs: number;

  private readonly streamStatus: BriaStreamHealthStatus;

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
    this.enabled = this.driver === 'bria' || this.driver === 'dfns';

    this.reconnectBaseMs = Number(this.config.get<string>('BRIA_STREAM_RECONNECT_BASE_MS', '1000'));
    this.reconnectMaxMs = Number(this.config.get<string>('BRIA_STREAM_RECONNECT_MAX_MS', '30000'));
    this.reconnectJitterMs = Number(this.config.get<string>('BRIA_STREAM_RECONNECT_JITTER_MS', '500'));

    this.streamStatus = {
      enabled: this.enabled,
      driver: this.driver,
      connected: false,
      reconnecting: false,
      reconnectAttempt: 0,
      committedCursor: 0,
      lastEventSequence: null,
      lastEventAt: null,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastError: null,
      nextRetryDelayMs: null,
    };
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('BTC_DELIVERY_DRIVER is not bria/dfns — skipping event subscription');
      return;
    }

    const cursor = await this.cursorStore.getCursor(CURSOR_NAME) ?? 0;
    this.committedCursor = cursor;
    this.streamStatus.committedCursor = cursor;

    await this.startSubscription('startup');
  }

  onModuleDestroy() {
    this.shuttingDown = true;
    this.clearReconnectTimer();

    if (this.subscription) {
      this.logger.log('Unsubscribing from Bria event stream');
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  getConnectivityStatus(): BriaStreamHealthStatus {
    return { ...this.streamStatus };
  }

  private async startSubscription(reason: string): Promise<void> {
    if (this.shuttingDown || !this.enabled) return;

    this.clearReconnectTimer();

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    this.processingQueue = Promise.resolve();

    this.logger.log(
      `Starting Bria event subscription (driver=${this.driver}, cursor=${this.committedCursor}, reason=${reason})`,
    );

    const stream$ = this.briaClient.subscribeAll({
      afterSequence: this.committedCursor,
      augment: true,
    });

    this.markConnected();

    this.subscription = stream$.subscribe({
      next: (event: BriaEvent) => {
        this.processingQueue = this.processingQueue
          .then(async () => {
            await this.handleEvent(event);
          })
          .catch(async (err) => {
            await this.handleStreamFailure('event_processing_error', err, event.sequence);
          });
      },
      error: (err) => {
        void this.handleStreamFailure('stream_error', err);
      },
      complete: () => {
        void this.handleStreamFailure('stream_completed');
      },
    });
  }

  private markConnected(): void {
    this.streamStatus.connected = true;
    this.streamStatus.reconnecting = false;
    this.streamStatus.reconnectAttempt = 0;
    this.streamStatus.nextRetryDelayMs = null;
    this.streamStatus.lastConnectedAt = new Date().toISOString();
  }

  private markDisconnected(err?: unknown): void {
    this.streamStatus.connected = false;
    this.streamStatus.lastDisconnectedAt = new Date().toISOString();

    if (!err) return;
    if (err instanceof Error) {
      this.streamStatus.lastError = err.message;
      return;
    }

    this.streamStatus.lastError = String(err);
  }

  private async handleStreamFailure(kind: string, err?: unknown, sequence?: number): Promise<void> {
    if (this.shuttingDown || !this.enabled) return;

    if (sequence !== undefined) {
      this.logger.error(
        `Bria event stream processing failure at seq=${sequence} (${kind}) — reconnecting from cursor=${this.committedCursor}`,
        err instanceof Error ? err.stack : undefined,
      );
    } else if (err) {
      this.logger.error(`Bria stream failure (${kind}) — reconnecting from cursor=${this.committedCursor}`, err);
    } else {
      this.logger.warn(`Bria stream completed unexpectedly — reconnecting from cursor=${this.committedCursor}`);
    }

    this.markDisconnected(err);

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.shuttingDown || !this.enabled) return;

    const nextAttempt = this.streamStatus.reconnectAttempt + 1;
    const baseDelay = Math.min(
      this.reconnectMaxMs,
      this.reconnectBaseMs * Math.pow(2, Math.max(0, nextAttempt - 1)),
    );
    const jitter = this.reconnectJitterMs > 0
      ? Math.floor(Math.random() * this.reconnectJitterMs)
      : 0;
    const delayMs = Math.min(this.reconnectMaxMs, baseDelay + jitter);

    this.streamStatus.reconnecting = true;
    this.streamStatus.reconnectAttempt = nextAttempt;
    this.streamStatus.nextRetryDelayMs = delayMs;

    this.logger.warn(`Scheduling Bria stream reconnect attempt ${nextAttempt} in ${delayMs}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.startSubscription(`reconnect_${nextAttempt}`);
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private async handleEvent(event: BriaEvent): Promise<void> {
    await this.processEvent(event.payload, event);

    // Persist cursor only after successful processing.
    await this.cursorStore.setCursor(CURSOR_NAME, event.sequence);
    this.committedCursor = event.sequence;
    this.streamStatus.committedCursor = event.sequence;
    this.streamStatus.lastEventSequence = event.sequence;
    this.streamStatus.lastEventAt = new Date().toISOString();
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
      return;
    }

    const payout = await this.findPayoutByProviderId(payload.data.id);
    if (!payout || !payout.externalId) {
      this.logger.debug(`No Koya payout for committed payout ${payload.data.id}, skipping PSBT signing`);
      return;
    }

    const augmentation = (event as unknown as Record<string, unknown>)['augmentation'] as
      | { payoutInfo?: { batchId?: string } }
      | undefined;
    let batchId = augmentation?.payoutInfo?.batchId;

    if (!batchId) {
      const payoutInfo = await this.briaClient.getPayout({ id: payload.data.id });
      batchId = payoutInfo.batchId;
    }

    if (!batchId) {
      this.logger.error(`No batchId found for payout ${payload.data.id} — cannot sign PSBT`);
      return;
    }

    await this.psbtSigningService.handlePayoutCommitted(
      payload.data.id,
      payout.externalId,
      batchId,
    );
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

    if (payout.externalId) {
      await this.psbtSigningService.markSettled(payout.externalId, payload.data.txId).catch((err) => {
        this.logger.debug(`PSBT settled update skipped: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

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
