import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MessagingProvider, MessagingEventStatus } from '@prisma/client';
import type { NormalizedInboundEvent } from './messaging.types';

@Injectable()
export class MessagingPersistenceService {
  private readonly logger = new Logger(MessagingPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async storeInboundEvent(input: {
    event: NormalizedInboundEvent;
    correlationId: string;
    causationId?: string;
  }): Promise<{ created: boolean; eventId: string | null }> {
    try {
      const created = await this.prisma.messagingEvent.create({
        data: {
          provider: input.event.provider,
          providerAccountId: input.event.providerAccountId,
          providerEventId: input.event.providerEventId,
          providerMessageId: input.event.providerMessageId,
          conversationExternalId: input.event.conversationExternalId,
          senderExternalId: input.event.senderExternalId,
          eventType: input.event.eventType,
          occurredAt: input.event.occurredAt,
          checksum: input.event.checksum,
          idempotencyKey: input.event.idempotencyKey,
          correlationId: input.correlationId,
          causationId: input.causationId ?? null,
          payloadJson: input.event.rawPayload as Prisma.InputJsonValue,
          rawPayloadRef: input.event.rawPayloadRef,
        },
      });

      return { created: true, eventId: created.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.debug(
          `Duplicate messaging event ignored provider=${input.event.provider} providerEventId=${input.event.providerEventId}`,
        );
        return { created: false, eventId: null };
      }
      throw error;
    }
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.prisma.messagingEvent.update({
      where: { id: eventId },
      data: {
        eventStatus: 'PROCESSED',
        processedAt: new Date(),
        nextRetryAt: null,
      },
    });
  }

  async markFailedWithRetry(input: {
    eventId: string;
    retryCount: number;
    nextRetryAt: Date | null;
    errorType: string;
    errorMessage: string;
  }): Promise<void> {
    await this.prisma.messagingEvent.update({
      where: { id: input.eventId },
      data: {
        eventStatus: input.nextRetryAt ? 'FAILED' : 'DEAD_LETTER',
        retryCount: input.retryCount,
        nextRetryAt: input.nextRetryAt,
        lastErrorType: input.errorType,
        lastErrorMessage: input.errorMessage.slice(0, 1024),
      },
    });
  }

  async createDeliveryAttempt(input: {
    messagingEventId: string;
    provider: MessagingProvider;
    attemptNumber: number;
    retryable: boolean;
    errorType?: string;
    errorMessage?: string;
    providerMessageId?: string;
    state: 'SENT' | 'FAILED' | 'RETRYING' | 'DEAD_LETTER';
    correlationId?: string;
    conversationId?: string;
    nextRetryAt?: Date | null;
  }): Promise<void> {
    await this.prisma.messagingDeliveryAttempt.create({
      data: {
        messagingEventId: input.messagingEventId,
        provider: input.provider,
        attemptNumber: input.attemptNumber,
        retryable: input.retryable,
        errorType: input.errorType,
        errorMessage: input.errorMessage,
        providerMessageId: input.providerMessageId,
        state: input.state,
        correlationId: input.correlationId,
        conversationId: input.conversationId,
        nextRetryAt: input.nextRetryAt ?? null,
      },
    });
  }

  async createDeadLetter(input: {
    messagingEventId: string;
    provider: MessagingProvider;
    correlationId: string;
    conversationId?: string;
    payloadRef: string;
    lastErrorType: string;
    lastErrorMessage: string;
    replayHint?: string;
  }): Promise<void> {
    await this.prisma.messagingDeadLetter.create({
      data: {
        messagingEventId: input.messagingEventId,
        provider: input.provider,
        conversationId: input.conversationId ?? null,
        correlationId: input.correlationId,
        payloadRef: input.payloadRef,
        lastErrorType: input.lastErrorType,
        lastErrorMessage: input.lastErrorMessage.slice(0, 2048),
        replayHint: input.replayHint ?? null,
      },
    });
  }

  async recordTemplateDispatch(input: {
    provider: MessagingProvider;
    conversationId?: string;
    templateKey: string;
    providerTemplateId?: string | null;
    providerMessageId?: string | null;
    correlationId: string;
    payloadJson?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.messagingTemplateDispatch.create({
      data: {
        provider: input.provider,
        conversationId: input.conversationId ?? null,
        templateKey: input.templateKey,
        providerTemplateId: input.providerTemplateId ?? null,
        providerMessageId: input.providerMessageId ?? null,
        correlationId: input.correlationId,
        payloadJson: input.payloadJson
          ? (input.payloadJson as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  async recordTrackingLinkDispatch(input: {
    provider: MessagingProvider;
    conversationId?: string;
    conversionSessionId?: string;
    referenceCode: string;
    trackingUrl: string;
    providerMessageId?: string | null;
    correlationId: string;
    status?: string;
  }): Promise<void> {
    await this.prisma.trackingLinkDispatch.create({
      data: {
        provider: input.provider,
        conversationId: input.conversationId ?? null,
        conversionSessionId: input.conversionSessionId ?? null,
        referenceCode: input.referenceCode,
        trackingUrl: input.trackingUrl,
        providerMessageId: input.providerMessageId ?? null,
        correlationId: input.correlationId,
        status: input.status ?? 'SENT',
      },
    });
  }

  async findDueRetries(now: Date, limit = 100): Promise<Array<{ id: string }>> {
    return this.prisma.messagingEvent.findMany({
      where: {
        eventStatus: 'FAILED' as MessagingEventStatus,
        nextRetryAt: {
          lte: now,
        },
      },
      select: { id: true },
      orderBy: { nextRetryAt: 'asc' },
      take: limit,
    });
  }

  async getEventById(eventId: string) {
    return this.prisma.messagingEvent.findUnique({ where: { id: eventId } });
  }
}
