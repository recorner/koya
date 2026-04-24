import { ConfigService } from '@nestjs/config';
import { TelegramProvider } from '../providers/telegram.provider';
import { WebhookSignatureError } from '../messaging.errors';

describe('TelegramProvider', () => {
  const provider = new TelegramProvider(
    new ConfigService({
      MESSAGING_ENABLE_TELEGRAM: 'true',
      TELEGRAM_BOT_TOKEN: '1234:test',
      TELEGRAM_WEBHOOK_SECRET: 'secret',
      TELEGRAM_ALLOWED_IPS: '',
    }),
  );

  it('accepts valid secret token', () => {
    expect(() =>
      provider.verifyWebhook({
        headers: { 'x-telegram-bot-api-secret-token': 'secret' },
      }),
    ).not.toThrow();
  });

  it('rejects invalid secret token', () => {
    expect(() =>
      provider.verifyWebhook({
        headers: { 'x-telegram-bot-api-secret-token': 'bad' },
      }),
    ).toThrow(WebhookSignatureError);
  });

  it('normalizes message updates', () => {
    const [event] = provider.normalizeInbound({
      payload: {
        update_id: 1,
        message: {
          message_id: 22,
          date: 1713700000,
          text: '/start',
          chat: { id: 9911 },
          from: { id: 4455 },
        },
      },
      rawBody: '{"ok":true}',
    });

    expect(event).toBeDefined();
    expect(event!.messageText).toBe('/start');
    expect(event!.providerMessageId).toBe('msg:9911:22');
    expect(event!.webhookEventKind).toBe('message');
    expect(event!.callbackQueryId).toBeUndefined();
  });

  it('normalizes callback_query updates', () => {
    const [event] = provider.normalizeInbound({
      payload: {
        update_id: 2,
        callback_query: {
          id: 'cb_1',
          data: 'menu:transactions',
          from: { id: 4455 },
          message: {
            message_id: 23,
            date: 1713700001,
            text: 'Choose',
            chat: { id: 9911 },
          },
        },
      },
      rawBody: '{"ok":true}',
    });

    expect(event).toBeDefined();
    expect(event!.messageText).toBe('menu:transactions');
    expect(event!.providerMessageId).toBe('cb:cb_1');
    expect(event!.webhookEventKind).toBe('callback_query');
    expect(event!.callbackQueryId).toBe('cb_1');
    expect(event!.rawPayload['buttonPayload']).toBe('menu:transactions');
  });

  it('ignores unsupported Telegram update types', () => {
    const events = provider.normalizeInbound({
      payload: {
        update_id: 3,
        edited_message: {
          message_id: 99,
        },
      } as unknown as Record<string, unknown>,
      rawBody: '{"ok":true}',
    });

    expect(events).toEqual([]);
  });

  it('ignores malformed Telegram update shells without update_id', () => {
    const events = provider.normalizeInbound({
      payload: {
        message: {
          message_id: 25,
          text: 'hello',
          chat: { id: 9912 },
          from: { id: 4456 },
        },
      } as unknown as Record<string, unknown>,
      rawBody: '{"ok":true}',
    });

    expect(events).toEqual([]);
  });

  it('ignores non-text Telegram messages', () => {
    const events = provider.normalizeInbound({
      payload: {
        update_id: 4,
        message: {
          message_id: 24,
          date: 1713700002,
          chat: { id: 9911 },
          from: { id: 4455 },
        },
      },
      rawBody: '{"ok":true}',
    });

    expect(events).toEqual([]);
  });

  it('acknowledges callback queries', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ ok: true }),
    });
    (global as typeof global & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    await provider.acknowledgeInboundEvent?.({
      event: {
        provider: 'TELEGRAM',
        providerAccountId: 'acct',
        providerEventId: '2',
        providerMessageId: '23',
        conversationExternalId: '9911',
        senderExternalId: '4455',
        eventType: 'INBOUND_MESSAGE',
        occurredAt: new Date(),
        checksum: 'abc',
        idempotencyKey: 'idempotency',
        rawPayloadRef: 'telegram:2',
        messageText: 'menu:transactions',
        rawPayload: {},
        callbackQueryId: 'cb_1',
      },
      correlationId: 'corr-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
