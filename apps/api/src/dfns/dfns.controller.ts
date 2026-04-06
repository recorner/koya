import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  Logger,
  UnauthorizedException,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
// Use a minimal type for the request body instead of importing express
interface MinimalRequest {
  body: unknown;
}
import { DfnsService } from './dfns.service';
import { ProcessedWebhookService } from '../webhooks/processed-webhook.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookThrottle } from '../security/throttle.decorators';

interface DfnsWebhookPayload {
  id: string;
  kind: string;
  status: string;
  externalId?: string;
  txHash?: string;
  dateCreated?: string;
  dateFinished?: string;
  metadata?: Record<string, unknown>;
}

@Controller('dfns')
@WebhookThrottle()
export class DfnsController {
  private readonly logger = new Logger(DfnsController.name);

  constructor(
    private readonly dfnsService: DfnsService,
    private readonly webhookService: ProcessedWebhookService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * POST /api/v1/dfns/webhook
   *
   * Handles DFNS webhook callbacks for custody transfer status updates.
   * Idempotent: duplicate webhooks are ignored via processed_webhooks table.
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() payload: DfnsWebhookPayload,
    @Headers('x-dfns-signature') signature: string | undefined,
    @Req() req: MinimalRequest,
  ) {
    this.logger.log(
      `DFNS webhook received: id=${payload.id} status=${payload.status} externalId=${payload.externalId ?? 'none'}`,
    );

    // Step 1: Verify signature
    const rawBody =
      typeof req.body === 'string' ? req.body : JSON.stringify(payload);

    if (!signature || !this.dfnsService.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('DFNS webhook signature verification failed');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const externalId = payload.externalId;
    if (!externalId) {
      this.logger.warn('DFNS webhook missing externalId');
      return { status: 'ignored', reason: 'no externalId' };
    }

    // Step 2: Idempotency check via processed_webhooks
    const isNew = await this.webhookService.markProcessed('dfns', externalId);
    if (!isNew) {
      this.logger.log(`DFNS webhook already processed: externalId=${externalId}`);
      return { status: 'already_processed' };
    }

    // Step 3: Look up the DFNS request
    const dfnsRequest = await this.dfnsService.getRequestByExternalId(externalId);
    if (!dfnsRequest) {
      this.logger.warn(
        `DFNS webhook for unknown externalId=${externalId}, queued for review`,
      );
      throw new NotFoundException(
        `No DFNS request found for externalId=${externalId}`,
      );
    }

    // Step 4: Process based on status
    if (payload.status === 'Executed' || payload.status === 'Confirmed') {
      await this.handleSuccess(dfnsRequest, payload);
    } else if (payload.status === 'Failed' || payload.status === 'Rejected') {
      await this.handleFailure(dfnsRequest, payload);
    } else {
      this.logger.log(
        `DFNS webhook status=${payload.status} — no action taken`,
      );
    }

    return { status: 'processed' };
  }

  private async handleSuccess(
    dfnsRequest: { id: string; externalId: string },
    payload: DfnsWebhookPayload,
  ) {
    const txId = payload.txHash ?? payload.id;

    // Update DFNS request record
    await this.dfnsService.updateRequestStatus(
      dfnsRequest.externalId,
      'COMPLETED',
      txId,
    );

    // Find the payout instruction by externalId
    const payout = await this.prisma.payoutInstruction.findUnique({
      where: { externalId: dfnsRequest.externalId },
    });

    if (!payout) {
      this.logger.warn(
        `No PayoutInstruction found for externalId=${dfnsRequest.externalId}`,
      );
      return;
    }

    // Skip if already confirmed
    if (payout.status === 'CONFIRMED') {
      this.logger.log(
        `PayoutInstruction already CONFIRMED for ${dfnsRequest.externalId}`,
      );
      return;
    }

    // Update payout instruction
    await this.prisma.payoutInstruction.update({
      where: { id: payout.id },
      data: {
        status: 'CONFIRMED',
        providerPayoutId: payload.id,
        txHash: txId,
      },
    });

    // Emit event for ConversionService to advance session to COMPLETED
    this.eventEmitter.emit('delivery.confirmed', {
      sessionId: payout.conversionSessionId,
      txId,
      provider: 'dfns',
      providerRequestId: payload.id,
    });

    this.logger.log(
      `DFNS delivery confirmed: sessionId=${payout.conversionSessionId} txId=${txId}`,
    );
  }

  private async handleFailure(
    dfnsRequest: { id: string; externalId: string },
    payload: DfnsWebhookPayload,
  ) {
    await this.dfnsService.updateRequestStatus(
      dfnsRequest.externalId,
      'FAILED',
    );

    const payout = await this.prisma.payoutInstruction.findUnique({
      where: { externalId: dfnsRequest.externalId },
    });

    if (!payout) return;

    await this.prisma.payoutInstruction.update({
      where: { id: payout.id },
      data: { status: 'FAILED' },
    });

    // Emit failure event for ConversionService
    this.eventEmitter.emit('delivery.failed', {
      sessionId: payout.conversionSessionId,
      provider: 'dfns',
      reason: payload.status,
    });

    this.logger.warn(
      `DFNS delivery failed: sessionId=${payout.conversionSessionId} status=${payload.status}`,
    );
  }
}
