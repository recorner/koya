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

  public readonly sentMessages: Array<{ to: string; message: ChatOutboundMessage }> = [];

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
    this.sentMessages.push({ to: input.recipient, message: input.message });
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
    this.sentMessages.push({ to: input.recipient, message: input.message });
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
      message: { body: `Track ${input.referenceCode} ${input.trackingUrl}` },
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
    process.env['WHATSAPP_BUSINESS_ACCOUNT_ID'] = '654321';

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

  it('routes Telegram callback payloads into visible menu actions', async () => {
    const sender = `tg-menu-${Date.now()}`;
    const before = fakeTelegram.sentMessages.length;

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: '/start',
      providerMessageId: newMsgId(),
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: 'menu:start_conversion',
      providerMessageId: newMsgId(),
      rawPayload: { buttonPayload: 'menu:start_conversion' },
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: 'menu:back',
      providerMessageId: newMsgId(),
      rawPayload: { buttonPayload: 'menu:back' },
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: 'menu:transactions',
      providerMessageId: newMsgId(),
      rawPayload: { buttonPayload: 'menu:transactions' },
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: 'menu:track_order',
      providerMessageId: newMsgId(),
      rawPayload: { buttonPayload: 'menu:track_order' },
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: 'menu:help',
      providerMessageId: newMsgId(),
      rawPayload: { buttonPayload: 'menu:help' },
    });

    await flowService.handleInboundMessage({
      provider: 'TELEGRAM',
      from: sender,
      body: '/start',
      providerMessageId: newMsgId(),
    });

    const sent = fakeTelegram.sentMessages.slice(before).map((item) => item.message);
    const latestBodies = sent.map((message) => message.body).join('\n---\n');

    expect(latestBodies).toContain('Telegram Desk');
    expect(latestBodies).toContain('Start Conversion');
    expect(latestBodies).toContain('Transactions');
    expect(latestBodies).toContain('Track Order');
    expect(latestBodies).toContain('Koya Help');
    expect(latestBodies).toContain('Telegram Desk');

    const startConversionMessage = sent.find((message) =>
      message.body.includes('Send the KES amount to convert.'),
    );
    expect(startConversionMessage?.interactive?.buttons.map((button) => button.id)).toEqual([
      'menu:back',
      'menu:restart',
    ]);
  });
});
