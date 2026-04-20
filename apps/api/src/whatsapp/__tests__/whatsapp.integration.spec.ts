import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheModule } from '../../cache/cache.module';
import { MessagingModule } from '../../messaging/messaging.module';
import { ChatConversionFlowService } from '../../messaging/chat-conversion-flow.service';
import {
  MESSAGING_PROVIDERS,
  type MessagingProvider,
} from '../../messaging/providers/messaging-provider.interface';
import type {
  ChatOutboundMessage,
  ProviderHealthMetadata,
  ProviderSendResult,
  RetryClassification,
  NormalizedInboundEvent,
} from '../../messaging/messaging.types';
import { randomUUID } from 'crypto';

class FakeProvider implements MessagingProvider {
  constructor(public readonly provider: 'WHATSAPP_CLOUD' | 'TELEGRAM') {}

  public readonly sentMessages: Array<{ to: string; body: string }> = [];

  verifyWebhook(): void {}
  verifyChallenge(): { accepted: boolean } {
    return { accepted: true };
  }
  normalizeInbound(): NormalizedInboundEvent[] {
    return [];
  }
  classifyError(): RetryClassification {
    return { retryable: false, reason: 'test' };
  }
  healthMetadata(): ProviderHealthMetadata {
    return { provider: this.provider, healthy: true, capabilities: ['text'] };
  }

  async sendTextMessage(input: {
    recipient: string;
    message: ChatOutboundMessage;
  }): Promise<ProviderSendResult> {
    this.sentMessages.push({ to: input.recipient, body: input.message.body });
    return {
      success: true,
      providerMessageId: `MSG-${randomUUID()}`,
      channel: 'text',
    };
  }

  async sendTemplateMessage(input: {
    recipient: string;
    message: ChatOutboundMessage;
  }): Promise<ProviderSendResult> {
    this.sentMessages.push({ to: input.recipient, body: input.message.body });
    return {
      success: true,
      providerMessageId: `TPL-${randomUUID()}`,
      channel: 'quick_reply',
      providerTemplateId: 'fake-template',
    };
  }

  async sendTrackingLink(input: {
    recipient: string;
    trackingUrl: string;
    referenceCode: string;
  }): Promise<ProviderSendResult> {
    this.sentMessages.push({
      to: input.recipient,
      body: `Track ${input.referenceCode} ${input.trackingUrl}`,
    });
    return {
      success: true,
      providerMessageId: `TRK-${randomUUID()}`,
      channel: 'text',
    };
  }
}

describe('Chat Flow (Integration)', () => {
  let module: TestingModule;
  let flowService: ChatConversionFlowService;
  let prisma: PrismaService;
  const fakeWhatsApp = new FakeProvider('WHATSAPP_CLOUD');
  const fakeTelegram = new FakeProvider('TELEGRAM');

  beforeAll(async () => {
    process.env['MESSAGING_ENABLE_WHATSAPP_CLOUD'] = 'true';
    process.env['MESSAGING_ENABLE_TELEGRAM'] = 'true';
    process.env['WHATSAPP_WEB_BASE_URL'] = 'https://koyabank.com';

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        PrismaModule,
        CacheModule,
        MessagingModule,
      ],
    })
      .overrideProvider(MESSAGING_PROVIDERS)
      .useValue([fakeWhatsApp, fakeTelegram])
      .compile();

    flowService = module.get(ChatConversionFlowService);
    prisma = module.get(PrismaService);
  }, 30000);

  afterAll(async () => {
    await module.close();
  });

  function newMsgId(): string {
    return `M-${randomUUID().replace(/-/g, '')}`;
  }

  it('creates a conversation and stores inbound event', async () => {
    const phone = `+2547${Date.now().toString().slice(-8)}`;
    const msgId = newMsgId();

    await flowService.handleInboundMessage({
      provider: 'WHATSAPP_CLOUD',
      from: phone,
      body: 'hello',
      providerMessageId: msgId,
    });

    const conv = await prisma.whatsAppConversation.findFirst({
      where: { phoneNumber: phone, provider: 'WHATSAPP_CLOUD' },
    });

    expect(conv).toBeTruthy();

    const event = await prisma.whatsAppMessageEvent.findUnique({
      where: { providerMessageId: msgId },
    });

    expect(event).toBeTruthy();
    expect(event?.direction).toBe('INBOUND');
  });

  it('ignores duplicate provider message id', async () => {
    const phone = `+2547${Date.now().toString().slice(-8)}`;
    const msgId = newMsgId();

    await flowService.handleInboundMessage({
      provider: 'WHATSAPP_CLOUD',
      from: phone,
      body: 'hi',
      providerMessageId: msgId,
    });

    await flowService.handleInboundMessage({
      provider: 'WHATSAPP_CLOUD',
      from: phone,
      body: 'hi',
      providerMessageId: msgId,
    });

    const count = await prisma.whatsAppMessageEvent.count({
      where: { providerMessageId: msgId },
    });

    expect(count).toBe(1);
  });

  it('completes chat flow until processing stage over Telegram provider', async () => {
    const sender = `tg-${Date.now()}`;

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: 'hi',
      providerMessageId: newMsgId(),
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: '1',
      providerMessageId: newMsgId(),
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: '1000',
      providerMessageId: newMsgId(),
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: 'YES',
      providerMessageId: newMsgId(),
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: 'John Doe',
      providerMessageId: newMsgId(),
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: '12345678',
      providerMessageId: newMsgId(),
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: 'SKIP',
      providerMessageId: newMsgId(),
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: '0712345678',
      providerMessageId: newMsgId(),
    });

    const conv = await prisma.whatsAppConversation.findFirst({
      where: { phoneNumber: sender, provider: 'TELEGRAM', status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    expect(conv).toBeTruthy();
    expect(conv?.currentStep).toBe('WAITING_FOR_BTC_ADDRESS');
    expect(fakeTelegram.sentMessages.length).toBeGreaterThan(0);
  });
});
