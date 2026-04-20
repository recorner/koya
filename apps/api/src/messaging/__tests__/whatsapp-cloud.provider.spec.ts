import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { WhatsAppCloudProvider } from '../providers/whatsapp-cloud.provider';
import { PayloadValidationError, WebhookSignatureError } from '../messaging.errors';

describe('WhatsAppCloudProvider', () => {
  const provider = new WhatsAppCloudProvider(
    new ConfigService({
      MESSAGING_ENABLE_WHATSAPP_CLOUD: 'true',
      WHATSAPP_CLOUD_API_VERSION: 'v21.0',
      WHATSAPP_PHONE_NUMBER_ID: '123',
      WHATSAPP_ACCESS_TOKEN: 'token',
      WHATSAPP_APP_SECRET: 'secret',
      WHATSAPP_VERIFY_TOKEN: 'verify',
    }),
  );

  it('verifies webhook signature', () => {
    const rawBody = JSON.stringify({ hello: 'world' });
    const sig = createHmac('sha256', 'secret').update(rawBody).digest('hex');

    expect(() =>
      provider.verifyWebhook({
        headers: { 'x-hub-signature-256': `sha256=${sig}` },
        rawBody,
      }),
    ).not.toThrow();
  });

  it('rejects invalid webhook signature', () => {
    const rawBody = JSON.stringify({ hello: 'world' });

    expect(() =>
      provider.verifyWebhook({
        headers: { 'x-hub-signature-256': 'sha256=bad' },
        rawBody,
      }),
    ).toThrow(WebhookSignatureError);
  });

  it('accepts status-only webhook payloads as no-op', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: 'wamid.status.1',
                    status: 'delivered',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(
      provider.normalizeInbound({
        payload,
        rawBody: JSON.stringify(payload),
      }),
    ).toEqual([]);
  });

  it('rejects malformed payloads without webhook envelope', () => {
    expect(() =>
      provider.normalizeInbound({
        payload: {},
        rawBody: '{}',
      }),
    ).toThrow(PayloadValidationError);
  });
});
