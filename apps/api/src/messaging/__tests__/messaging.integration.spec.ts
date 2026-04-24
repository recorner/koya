import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHmac } from 'crypto';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessagingModule } from '../messaging.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { CacheModule } from '../../cache/cache.module';
import { ChatConversionFlowService } from '../chat-conversion-flow.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('Messaging Webhooks (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const handleInboundMessage = jest.fn();

  beforeAll(async () => {
    process.env['MESSAGING_ENABLE_WHATSAPP_CLOUD'] = 'true';
    process.env['MESSAGING_ENABLE_TELEGRAM'] = 'true';
    process.env['WHATSAPP_APP_SECRET'] = 'test-app-secret';
    process.env['WHATSAPP_VERIFY_TOKEN'] = 'test-verify-token';
    process.env['WHATSAPP_ACCESS_TOKEN'] = 'test-access-token';
    process.env['WHATSAPP_PHONE_NUMBER_ID'] = '123456';
    process.env['WHATSAPP_BUSINESS_ACCOUNT_ID'] = '654321';
    process.env['TELEGRAM_BOT_TOKEN'] = '123456:TEST';
    process.env['TELEGRAM_WEBHOOK_SECRET'] = 'telegram-secret';
    process.env['WHATSAPP_WEB_BASE_URL'] = 'https://koyabank.com';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        PrismaModule,
        CacheModule,
        MessagingModule,
      ],
    })
      .overrideProvider(ChatConversionFlowService)
      .useValue({
        handleInboundMessage,
        sendCompletionNotification: jest.fn(),
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts WhatsApp webhook with valid signature', async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '123456' },
                messages: [
                  {
                    id: `wamid.${Date.now()}`,
                    from: '+254700000001',
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: 'text',
                    text: { body: 'hello' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const body = JSON.stringify(payload);
    const sig = createHmac('sha256', 'test-app-secret').update(body).digest('hex');

    const res = await request(app.getHttpServer())
      .post('/messaging/webhooks/whatsapp-cloud')
      .set('x-hub-signature-256', `sha256=${sig}`)
      .set('content-type', 'application/json')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
    expect(handleInboundMessage).toHaveBeenCalled();
  });

  it('accepts WhatsApp status-only webhook payloads as no-op', async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '123456' },
                statuses: [
                  {
                    id: `wamid.status.${Date.now()}`,
                    status: 'delivered',
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    recipient_id: '+254700000001',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const body = JSON.stringify(payload);
    const sig = createHmac('sha256', 'test-app-secret').update(body).digest('hex');
    const callsBefore = handleInboundMessage.mock.calls.length;

    const res = await request(app.getHttpServer())
      .post('/messaging/webhooks/whatsapp-cloud')
      .set('x-hub-signature-256', `sha256=${sig}`)
      .set('content-type', 'application/json')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
    expect(handleInboundMessage.mock.calls.length).toBe(callsBefore);
  });

  it('rejects WhatsApp webhook with bad signature', async () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '123456' },
                messages: [
                  {
                    id: `wamid.${Date.now()}x`,
                    from: '+254700000002',
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: 'text',
                    text: { body: 'hello' },
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
      .set('x-hub-signature-256', 'sha256=bad')
      .set('content-type', 'application/json')
      .send(payload);

    expect(res.status).toBe(401);
  });

  it('accepts Telegram webhook with valid secret', async () => {
    const updateId = Date.now();
    const payload = {
      update_id: updateId,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 99887766 },
        from: { id: 99887766 },
        text: 'hello',
      },
    };

    const res = await request(app.getHttpServer())
      .post('/messaging/webhooks/telegram')
      .set('x-telegram-bot-api-secret-token', 'telegram-secret')
      .set('content-type', 'application/json')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');

    const event = await prisma.messagingEvent.findFirst({
      where: {
        provider: 'TELEGRAM',
        providerEventId: String(updateId),
      },
    });
    expect(event).toBeTruthy();
  });

  it('accepts Telegram callback_query webhook and routes callback payload', async () => {
    const updateId = Date.now() + 1;
    const payload = {
      update_id: updateId,
      callback_query: {
        id: `cb_${updateId}`,
        data: 'menu:transactions',
        from: { id: 99887766 },
        message: {
          message_id: 2,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 99887766 },
          text: 'Choose',
        },
      },
    };

    const callsBefore = handleInboundMessage.mock.calls.length;
    const originalFetch = (global as typeof global & { fetch?: typeof fetch }).fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ ok: true }),
    });
    (global as typeof global & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    try {
      const res = await request(app.getHttpServer())
        .post('/messaging/webhooks/telegram')
        .set('x-telegram-bot-api-secret-token', 'telegram-secret')
        .set('content-type', 'application/json')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('accepted');

      const event = await prisma.messagingEvent.findFirst({
        where: {
          provider: 'TELEGRAM',
          providerEventId: String(updateId),
        },
      });
      expect(event).toBeTruthy();
      expect(handleInboundMessage.mock.calls.length).toBe(callsBefore + 1);
      expect(handleInboundMessage.mock.calls.at(-1)?.[0]?.body).toBe('menu:transactions');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      (global as typeof global & { fetch?: typeof fetch }).fetch = originalFetch;
    }
  });

  it('rejects Telegram webhook with invalid secret', async () => {
    const payload = {
      update_id: Date.now(),
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 99887767 },
        from: { id: 99887767 },
        text: 'hello',
      },
    };

    const res = await request(app.getHttpServer())
      .post('/messaging/webhooks/telegram')
      .set('x-telegram-bot-api-secret-token', 'bad-secret')
      .set('content-type', 'application/json')
      .send(payload);

    expect(res.status).toBe(401);
  });
});
