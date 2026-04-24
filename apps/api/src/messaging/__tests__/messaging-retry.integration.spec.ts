import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import request from 'supertest';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheModule } from '../../cache/cache.module';
import { MessagingModule } from '../messaging.module';
import {
  MESSAGING_PROVIDERS,
  type MessagingProvider,
} from '../providers/messaging-provider.interface';
import type {
  ChatOutboundMessage,
  NormalizedInboundEvent,
  ProviderHealthMetadata,
  ProviderSendResult,
  RetryClassification,
} from '../messaging.types';
import { ProviderPermanentError } from '../messaging.errors';

class FailingWhatsAppProvider implements MessagingProvider {
  readonly provider = 'WHATSAPP_CLOUD' as const;

  verifyWebhook(): void {}

  verifyChallenge(): { accepted: boolean } {
    return { accepted: true };
  }

  normalizeInbound(input: {
    payload: Record<string, unknown>;
    rawBody: string;
  }): NormalizedInboundEvent[] {
    const entry = Array.isArray(input.payload['entry'])
      ? (input.payload['entry'] as Array<Record<string, unknown>>)
      : [];
    const changes = Array.isArray(entry[0]?.['changes'])
      ? (entry[0]?.['changes'] as Array<Record<string, unknown>>)
      : [];
    const message = (changes[0] ?? {}) as Record<string, unknown>;

    const value = (message?.['value'] as Record<string, unknown>) ?? {};
    const messages = Array.isArray(value['messages'])
      ? (value['messages'] as Array<Record<string, unknown>>)
      : [];

    const first = messages[0] ?? {};
    const providerEventId = String(first['id'] ?? `wamid.${Date.now()}`);
    const from = String(first['from'] ?? `2547${Date.now().toString().slice(-8)}`);
    const text = String(
      ((first['text'] as Record<string, unknown> | undefined)?.['body'] as string | undefined) ??
        'hi',
    );

    return [
      {
        provider: this.provider,
        providerAccountId: 'test-phone-id',
        providerEventId,
        providerMessageId: providerEventId,
        conversationExternalId: from,
        senderExternalId: from,
        eventType: 'INBOUND_MESSAGE',
        occurredAt: new Date(),
        checksum: 'checksum',
        idempotencyKey: `idempo-${providerEventId}`,
        rawPayloadRef: `meta:${providerEventId}`,
        messageText: text,
        rawPayload: first,
        webhookEventKind: 'message',
      },
    ];
  }

  classifyError(): RetryClassification {
    return { retryable: false, reason: 'forced_outbound_failure' };
  }

  healthMetadata(): ProviderHealthMetadata {
    return {
      provider: this.provider,
      healthy: true,
      capabilities: ['text', 'interactive', 'tracking_link'],
    };
  }

  async sendTextMessage(input: {
    recipient: string;
    message: ChatOutboundMessage;
    correlationId: string;
  }): Promise<ProviderSendResult> {
    throw new ProviderPermanentError(
      `forced outbound failure recipient=${input.recipient} correlation=${input.correlationId} body=${input.message.body}`,
    );
  }

  async sendTemplateMessage(input: {
    recipient: string;
    message: ChatOutboundMessage;
    correlationId: string;
  }): Promise<ProviderSendResult> {
    throw new ProviderPermanentError(
      `forced outbound failure recipient=${input.recipient} correlation=${input.correlationId} body=${input.message.body}`,
    );
  }

  async sendTrackingLink(): Promise<ProviderSendResult> {
    throw new ProviderPermanentError('forced outbound failure for tracking link');
  }
}

class StubTelegramProvider implements MessagingProvider {
  readonly provider = 'TELEGRAM' as const;

  verifyWebhook(): void {}
  verifyChallenge(): { accepted: boolean } {
    return { accepted: true };
  }
  normalizeInbound(): NormalizedInboundEvent[] {
    return [];
  }
  classifyError(): RetryClassification {
    return { retryable: false, reason: 'unused' };
  }
  healthMetadata(): ProviderHealthMetadata {
    return { provider: this.provider, healthy: true, capabilities: ['text'] };
  }
  async sendTextMessage(): Promise<ProviderSendResult> {
    return { success: true, providerMessageId: 'ok', channel: 'text' };
  }
  async sendTemplateMessage(): Promise<ProviderSendResult> {
    return { success: true, providerMessageId: 'ok', channel: 'text' };
  }
  async sendTrackingLink(): Promise<ProviderSendResult> {
    return { success: true, providerMessageId: 'ok', channel: 'text' };
  }
}

describe('Messaging Retry Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env['MESSAGING_ENABLE_WHATSAPP_CLOUD'] = 'true';
    process.env['MESSAGING_ENABLE_TELEGRAM'] = 'true';
    process.env['WHATSAPP_WEB_BASE_URL'] = 'https://koyabank.com';
    process.env['WHATSAPP_RATE_LIMIT_PER_MINUTE'] = '100';
    process.env['WHATSAPP_BUSINESS_ACCOUNT_ID'] = '654321';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        PrismaModule,
        CacheModule,
        MessagingModule,
      ],
    })
      .overrideProvider(MESSAGING_PROVIDERS)
      .useValue([new FailingWhatsAppProvider(), new StubTelegramProvider()])
      .compile();

    app = module.createNestApplication();
    await app.init();
    prisma = module.get(PrismaService);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('records delivery attempt + dead-letter when outbound reply fails', async () => {
    const providerMessageId = `wamid.integration.${Date.now()}`;
    const sender = `2547${Date.now().toString().slice(-8)}`;

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '123456' },
                messages: [
                  {
                    id: providerMessageId,
                    from: sender,
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: 'text',
                    text: { body: 'hi' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/messaging/webhooks/whatsapp-cloud')
      .set('content-type', 'application/json')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');

    const event = await prisma.messagingEvent.findFirst({
      where: {
        provider: 'WHATSAPP_CLOUD',
        providerEventId: providerMessageId,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(event).toBeTruthy();
    expect(event?.eventStatus).toBe('DEAD_LETTER');
    expect(event?.lastErrorMessage).toContain('forced outbound failure');

    const attempt = await prisma.messagingDeliveryAttempt.findFirst({
      where: { messagingEventId: event!.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(attempt).toBeTruthy();
    expect(attempt?.state).toBe('DEAD_LETTER');
    expect(attempt?.retryable).toBe(false);
    expect(attempt?.errorMessage).toContain('forced outbound failure');
  });
});
