import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  PayloadValidationError,
  ProviderPermanentError,
  ProviderTransientError,
  WebhookSignatureError,
} from '../messaging.errors';
import type {
  ChatOutboundMessage,
  NormalizedInboundEvent,
  ProviderHealthMetadata,
  ProviderSendResult,
  RetryClassification,
} from '../messaging.types';
import { buildIdempotencyKey, checksumPayload, firstHeader } from '../messaging.utils';
import type { MessagingProvider } from './messaging-provider.interface';

interface MetaMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
  type?: string;
}

@Injectable()
export class WhatsAppCloudProvider implements MessagingProvider {
  readonly provider = 'WHATSAPP_CLOUD' as const;
  private readonly logger = new Logger(WhatsAppCloudProvider.name);

  private readonly enabled: boolean;
  private readonly graphApiVersion: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly appSecret: string;
  private readonly verifyToken: string;

  constructor(private readonly config: ConfigService) {
    this.enabled =
      this.config.get<string>('MESSAGING_ENABLE_WHATSAPP_CLOUD', 'true') ===
      'true';
    this.graphApiVersion = this.config.get<string>('WHATSAPP_CLOUD_API_VERSION', 'v21.0');
    this.phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
    this.accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN', '');
    this.appSecret = this.config.get<string>('WHATSAPP_APP_SECRET', '');
    this.verifyToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', '');
  }

  verifyChallenge(input: {
    query: Record<string, string | string[] | undefined>;
  }): { accepted: boolean; challenge?: string } {
    const mode = this.singleQuery(input.query['hub.mode']);
    const token = this.singleQuery(input.query['hub.verify_token']);
    const challenge = this.singleQuery(input.query['hub.challenge']);

    if (mode === 'subscribe' && token === this.verifyToken && challenge) {
      return { accepted: true, challenge };
    }

    return { accepted: false };
  }

  verifyWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: string;
  }): void {
    this.ensureConfigured();
    const signatureHeader = firstHeader(input.headers, 'x-hub-signature-256');
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      throw new WebhookSignatureError('Missing or malformed x-hub-signature-256 header');
    }

    const signature = signatureHeader.slice('sha256='.length);
    const expected = createHmac('sha256', this.appSecret)
      .update(input.rawBody)
      .digest('hex');

    const actualBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');

    if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
      throw new WebhookSignatureError();
    }
  }

  normalizeInbound(input: {
    payload: Record<string, unknown>;
    rawBody: string;
  }): NormalizedInboundEvent[] {
    const entry = Array.isArray(input.payload['entry'])
      ? (input.payload['entry'] as Array<Record<string, unknown>>)
      : [];
    const hasWebhookEnvelope = entry.some((e) => Array.isArray(e['changes']));
    const events: NormalizedInboundEvent[] = [];

    for (const e of entry) {
      const changes = Array.isArray(e['changes'])
        ? (e['changes'] as Array<Record<string, unknown>>)
        : [];

      for (const change of changes) {
        const value = (change['value'] as Record<string, unknown>) ?? {};
        const metadata = (value['metadata'] as Record<string, unknown>) ?? {};
        const phoneNumberId = (metadata['phone_number_id'] as string) ?? this.phoneNumberId;

        const messages = Array.isArray(value['messages'])
          ? (value['messages'] as MetaMessage[])
          : [];

        for (const message of messages) {
          const messageId = message.id;
          const sender = message.from;
          if (!messageId || !sender) {
            this.logger.warn(
              `whatsapp.inbound_ignored_missing_fields type=${message.type ?? 'unknown'}`,
            );
            continue;
          }

          const text = this.extractInboundText(message);
          if (!text) {
            this.logger.log(
              `whatsapp.inbound_ignored type=${message.type ?? 'unknown'} messageId=${messageId}`,
            );
            continue;
          }

          const occurredAt = message.timestamp
            ? new Date(Number(message.timestamp) * 1000)
            : new Date();

          events.push({
            provider: this.provider,
            providerAccountId: phoneNumberId,
            providerEventId: messageId,
            providerMessageId: messageId,
            conversationExternalId: sender,
            senderExternalId: sender,
            eventType: 'INBOUND_MESSAGE',
            occurredAt,
            checksum: checksumPayload(input.rawBody),
            idempotencyKey: buildIdempotencyKey([this.provider, messageId, sender]),
            rawPayloadRef: `meta:${messageId}`,
            messageText: text,
            rawPayload: message as unknown as Record<string, unknown>,
          });
        }
      }
    }

    if (events.length === 0) {
      if (hasWebhookEnvelope) {
        // Meta can deliver status-only/non-message updates; treat as acknowledged no-op.
        return [];
      }
      throw new PayloadValidationError('No inbound WhatsApp messages found in payload');
    }

    return events;
  }

  async sendTextMessage(input: {
    recipient: string;
    message: ChatOutboundMessage;
    correlationId: string;
  }): Promise<ProviderSendResult> {
    this.ensureConfigured();
    return this.sendMessage(input.recipient, input.message, input.correlationId);
  }

  async sendTemplateMessage(input: {
    recipient: string;
    message: ChatOutboundMessage;
    correlationId: string;
  }): Promise<ProviderSendResult> {
    this.ensureConfigured();
    return this.sendMessage(input.recipient, input.message, input.correlationId);
  }

  async sendTrackingLink(input: {
    recipient: string;
    trackingUrl: string;
    referenceCode: string;
    correlationId: string;
  }): Promise<ProviderSendResult> {
    this.ensureConfigured();
    const body = `Track your Koya order (${input.referenceCode}): ${input.trackingUrl}`;
    return this.sendMessage(input.recipient, { body }, input.correlationId);
  }

  classifyError(error: unknown): RetryClassification {
    if (error instanceof ProviderTransientError) {
      return { retryable: true, reason: error.message, suggestedDelayMs: 2000 };
    }
    if (error instanceof ProviderPermanentError) {
      return { retryable: false, reason: error.message };
    }
    return { retryable: true, reason: 'unknown_provider_error', suggestedDelayMs: 3000 };
  }

  healthMetadata(): ProviderHealthMetadata {
    return {
      provider: this.provider,
      healthy:
        this.enabled &&
        Boolean(this.phoneNumberId && this.accessToken && this.appSecret && this.verifyToken),
      capabilities: ['text', 'interactive', 'tracking_link'],
    };
  }

  private ensureConfigured(): void {
    if (!this.enabled) {
      throw new ProviderPermanentError('WhatsApp Cloud provider is disabled');
    }

    if (!this.phoneNumberId || !this.accessToken || !this.appSecret || !this.verifyToken) {
      throw new ProviderPermanentError('WhatsApp Cloud provider is not configured');
    }
  }

  private async sendMessage(
    recipient: string,
    message: ChatOutboundMessage,
    correlationId: string,
  ): Promise<ProviderSendResult> {
    const endpoint = `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}/messages`;

    const payload = this.buildOutboundPayload(recipient, message);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const metaError = this.extractMetaError(json);
      const msg = metaError.message ?? response.statusText;
      const codePart = metaError.code != null ? ` code=${metaError.code}` : '';
      const subcodePart = metaError.subcode != null ? ` subcode=${metaError.subcode}` : '';
      const typePart = metaError.type ? ` type=${metaError.type}` : '';
      const details = `status=${response.status}${codePart}${subcodePart}${typePart} message=${msg}`;

      this.logger.warn(
        `[${correlationId}] whatsapp.send_failed recipient=${recipient} ${details}`,
      );

      if (response.status >= 500 || response.status === 429) {
        throw new ProviderTransientError(`WhatsApp Cloud transient error: ${details}`);
      }
      throw new ProviderPermanentError(`WhatsApp Cloud permanent error: ${details}`);
    }

    const messages = Array.isArray(json['messages'])
      ? (json['messages'] as Array<Record<string, unknown>>)
      : [];
    const providerMessageId = String(messages[0]?.['id'] ?? '');

    if (!providerMessageId) {
      throw new ProviderTransientError('WhatsApp Cloud response missing message id');
    }

    return {
      success: true,
      providerMessageId,
      channel: message.interactive ? 'quick_reply' : 'text',
      providerTemplateId: message.interactive?.providerTemplateId ?? null,
    };
  }

  private extractMetaError(payload: Record<string, unknown>): {
    message?: string;
    type?: string;
    code?: number;
    subcode?: number;
  } {
    const error = (payload['error'] as Record<string, unknown> | undefined) ?? {};
    const rawCode = error['code'];
    const rawSubcode = error['error_subcode'];
    return {
      message: typeof error['message'] === 'string' ? error['message'] : undefined,
      type: typeof error['type'] === 'string' ? error['type'] : undefined,
      code: typeof rawCode === 'number' ? rawCode : undefined,
      subcode: typeof rawSubcode === 'number' ? rawSubcode : undefined,
    };
  }

  private buildOutboundPayload(recipient: string, message: ChatOutboundMessage): Record<string, unknown> {
    if (message.interactive && message.interactive.buttons.length > 0) {
      return {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: message.body,
          },
          action: {
            buttons: message.interactive.buttons.slice(0, 3).map((button) => ({
              type: 'reply',
              reply: {
                id: button.id,
                title: button.title.slice(0, 20),
              },
            })),
          },
        },
      };
    }

    return {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'text',
      text: {
        body: message.body,
      },
    };
  }

  private extractInboundText(message: MetaMessage): string | undefined {
    if (message.text?.body) {
      return message.text.body;
    }

    if (message.button?.payload) {
      return message.button.payload;
    }

    if (message.button?.text) {
      return message.button.text;
    }

    if (message.interactive?.button_reply?.id) {
      return message.interactive.button_reply.id;
    }

    if (message.interactive?.button_reply?.title) {
      return message.interactive.button_reply.title;
    }

    if (message.interactive?.list_reply?.id) {
      return message.interactive.list_reply.id;
    }

    if (message.interactive?.list_reply?.title) {
      return message.interactive.list_reply.title;
    }

    return undefined;
  }

  private singleQuery(value: string | string[] | undefined): string | undefined {
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }
}
