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
});
