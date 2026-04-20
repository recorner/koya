import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Cron } from '@nestjs/schedule';
import type { MessagingProviderType } from './messaging.types';
import { MessagingProviderRouter } from './messaging-provider.router';
import { MessagingPersistenceService } from './messaging-persistence.service';
import { ChatConversionFlowService } from './chat-conversion-flow.service';
import {
  PayloadValidationError,
  ProviderPermanentError,
  WebhookSignatureError,
} from './messaging.errors';
import { backoffDelayMs } from './messaging.utils';

@Injectable()
export class MessagingOrchestratorService {
  private readonly logger = new Logger(MessagingOrchestratorService.name);
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;

  constructor(
    private readonly providerRouter: MessagingProviderRouter,
    private readonly persistence: MessagingPersistenceService,
    private readonly chatFlow: ChatConversionFlowService,
  ) {
    this.maxRetries = Number(process.env['MESSAGING_MAX_RETRIES'] ?? 4);
    this.baseBackoffMs = Number(process.env['MESSAGING_RETRY_BASE_MS'] ?? 1200);
  }

  async handleWebhook(input: {
    provider: MessagingProviderType;
    headers: Record<string, string | string[] | undefined>;
    payload: Record<string, unknown>;
    rawBody: string;
    query?: Record<string, string | string[] | undefined>;
    correlationId?: string;
  }): Promise<{ accepted: boolean; reason?: string; challenge?: string }> {
    const correlationId = input.correlationId ?? randomUUID();
    const provider = this.providerRouter.getProvider(input.provider);

    if (provider.verifyChallenge && input.query) {
      const challengeResult = provider.verifyChallenge({ query: input.query });
      if (challengeResult.accepted) {
        return {
          accepted: true,
          challenge: challengeResult.challenge,
        };
      }
    }

    provider.verifyWebhook({
      headers: input.headers,
      rawBody: input.rawBody,
      query: input.query,
    });

    const events = provider.normalizeInbound({
      headers: input.headers,
      payload: input.payload,
      rawBody: input.rawBody,
    });

    for (const event of events) {
      const stored = await this.persistence.storeInboundEvent({
        event,
        correlationId,
      });

      if (!stored.created || !stored.eventId) {
        continue;
      }

      try {
        if (event.eventType === 'INBOUND_MESSAGE') {
          await this.chatFlow.handleInboundMessage({
            provider: event.provider,
            from: event.senderExternalId,
            body: event.messageText,
            providerMessageId: event.providerMessageId ?? event.providerEventId,
            rawPayload: event.rawPayload,
            correlationId,
          });
        }

        await this.persistence.markProcessed(stored.eventId);
      } catch (error) {
        await this.handleProcessingError({
          eventId: stored.eventId,
          eventProvider: event.provider,
          correlationId,
          error,
          payloadRef: event.rawPayloadRef,
          conversationId: event.conversationExternalId,
        });
      }
    }

    return { accepted: true };
  }

  @Cron('*/20 * * * * *')
  async processRetries(): Promise<void> {
    const now = new Date();
    const due = await this.persistence.findDueRetries(now, 100);

    for (const row of due) {
      const event = await this.persistence.getEventById(row.id);
      if (!event) {
        continue;
      }

      const provider = this.providerRouter.getProvider(event.provider as MessagingProviderType);
      const payload = event.payloadJson as Record<string, unknown>;
      const body = String(payload['text'] ?? '');

      try {
        await this.chatFlow.handleInboundMessage({
          provider: event.provider as MessagingProviderType,
          from: event.senderExternalId,
          body,
          providerMessageId: event.providerMessageId ?? event.providerEventId,
          rawPayload: payload,
          correlationId: event.correlationId ?? randomUUID(),
        });

        await this.persistence.markProcessed(event.id);
      } catch (error) {
        const classification = provider.classifyError(error);
        await this.handleProcessingError({
          eventId: event.id,
          eventProvider: event.provider as MessagingProviderType,
          correlationId: event.correlationId ?? randomUUID(),
          error,
          payloadRef: event.rawPayloadRef,
          conversationId: event.conversationExternalId,
          retryCount: event.retryCount,
          providerRetryableOverride: classification.retryable,
        });
      }
    }
  }

  private async handleProcessingError(input: {
    eventId: string;
    eventProvider: MessagingProviderType;
    correlationId: string;
    error: unknown;
    payloadRef: string;
    conversationId: string;
    retryCount?: number;
    providerRetryableOverride?: boolean;
  }): Promise<void> {
    const provider = this.providerRouter.getProvider(input.eventProvider);
    const classification = provider.classifyError(input.error);

    const retryableByType =
      !(input.error instanceof WebhookSignatureError) &&
      !(input.error instanceof PayloadValidationError) &&
      !(input.error instanceof ProviderPermanentError);

    const retryable =
      (input.providerRetryableOverride ?? classification.retryable) && retryableByType;

    const currentRetryCount = (input.retryCount ?? 0) + 1;
    const shouldRetry = retryable && currentRetryCount <= this.maxRetries;
    const nextRetryAt = shouldRetry
      ? new Date(Date.now() + backoffDelayMs(currentRetryCount, this.baseBackoffMs))
      : null;

    const errorType = input.error instanceof Error ? input.error.name : 'UnknownError';
    const errorMessage =
      input.error instanceof Error ? input.error.message : String(input.error);

    await this.persistence.createDeliveryAttempt({
      messagingEventId: input.eventId,
      provider: input.eventProvider,
      attemptNumber: currentRetryCount,
      retryable,
      errorType,
      errorMessage,
      state: shouldRetry ? 'RETRYING' : 'DEAD_LETTER',
      correlationId: input.correlationId,
      conversationId: input.conversationId,
      nextRetryAt,
    });

    await this.persistence.markFailedWithRetry({
      eventId: input.eventId,
      retryCount: currentRetryCount,
      nextRetryAt,
      errorType,
      errorMessage,
    });

    if (!shouldRetry) {
      await this.persistence.createDeadLetter({
        messagingEventId: input.eventId,
        provider: input.eventProvider,
        correlationId: input.correlationId,
        conversationId: input.conversationId,
        payloadRef: input.payloadRef,
        lastErrorType: errorType,
        lastErrorMessage: errorMessage,
        replayHint: 'Use messaging replay tooling to requeue by messaging_event_id',
      });

      this.logger.error(
        `[${input.correlationId}] dead-lettered event=${input.eventId} provider=${input.eventProvider} error=${errorType}`,
      );
    } else {
      this.logger.warn(
        `[${input.correlationId}] event=${input.eventId} retry=${currentRetryCount}/${this.maxRetries} next=${nextRetryAt?.toISOString()} reason=${classification.reason}`,
      );
    }
  }
}
