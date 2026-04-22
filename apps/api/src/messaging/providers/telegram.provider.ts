import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    date?: number;
    text?: string;
    chat?: { id?: number | string };
    from?: { id?: number | string };
  };
  callback_query?: {
    id?: string;
    data?: string;
    from?: { id?: number | string };
    message?: {
      message_id?: number;
      date?: number;
      text?: string;
      chat?: { id?: number | string };
    };
  };
}

@Injectable()
export class TelegramProvider implements MessagingProvider {
  readonly provider = 'TELEGRAM' as const;

  private readonly enabled: boolean;
  private readonly botToken: string;
  private readonly webhookSecret: string;
  private readonly allowedSourceIps: Set<string>;

  constructor(private readonly config: ConfigService) {
    this.enabled =
      this.config.get<string>('MESSAGING_ENABLE_TELEGRAM', 'true') === 'true';
    this.botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.webhookSecret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET', '');
    this.allowedSourceIps = new Set(
      this.config
        .get<string>('TELEGRAM_ALLOWED_IPS', '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    );
  }

  verifyWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
  }): void {
    this.ensureConfigured();
    const secret = firstHeader(input.headers, 'x-telegram-bot-api-secret-token');
    if (!secret || secret !== this.webhookSecret) {
      throw new WebhookSignatureError('Invalid Telegram webhook secret token');
    }

    const forwardedFor = firstHeader(input.headers, 'x-forwarded-for');
    if (this.allowedSourceIps.size > 0 && forwardedFor) {
      const ip = forwardedFor.split(',')[0]?.trim();
      if (ip && !this.allowedSourceIps.has(ip)) {
        throw new WebhookSignatureError('Telegram webhook source IP not allowed');
      }
    }
  }

  normalizeInbound(input: {
    payload: Record<string, unknown>;
    rawBody: string;
  }): NormalizedInboundEvent[] {
    this.ensureConfigured();
    const update = input.payload as TelegramUpdate;
    const updateId = update.update_id;
    if (typeof updateId !== 'number' || !Number.isFinite(updateId)) {
      // Ignore malformed update shells so Telegram receives 2xx instead of webhook 5xx.
      return [];
    }

    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      if (!callbackQuery.id || !callbackQuery.message?.chat?.id) {
        return [];
      }

      const chatId = String(callbackQuery.message.chat.id);
      const senderId = String(callbackQuery.from?.id ?? chatId);
      const callbackPayload = callbackQuery.data?.trim() || callbackQuery.message.text?.trim();
      if (!callbackPayload) {
        return [];
      }

      const messageId = callbackQuery.message.message_id
        ? String(callbackQuery.message.message_id)
        : `${updateId}`;

      return [
        {
          provider: this.provider,
          providerAccountId: this.botToken.slice(0, 12),
          providerEventId: String(updateId),
          providerMessageId: messageId,
          conversationExternalId: chatId,
          senderExternalId: senderId,
          eventType: 'INBOUND_MESSAGE',
          occurredAt: callbackQuery.message.date
            ? new Date(callbackQuery.message.date * 1000)
            : new Date(),
          checksum: checksumPayload(input.rawBody),
          idempotencyKey: buildIdempotencyKey([
            this.provider,
            String(updateId),
            chatId,
          ]),
          rawPayloadRef: `telegram:${updateId}`,
          messageText: callbackPayload,
          rawPayload: {
            ...input.payload,
            updateType: 'callback_query',
            buttonPayload: callbackQuery.data ?? callbackPayload,
            buttonText: callbackQuery.message.text ?? null,
            callbackQueryId: callbackQuery.id,
          },
          webhookEventKind: 'callback_query',
          callbackQueryId: callbackQuery.id,
        },
      ];
    }

    if (!update.message) {
      // Ignore unsupported Telegram update types (e.g. edited_message, chat_member, etc.)
      // so Telegram never sees webhook 5xx for non-message updates.
      return [];
    }

    if (!update.message.chat?.id || !update.message.text) {
      // Ignore non-text message updates to keep webhook processing resilient.
      return [];
    }

    const chatId = String(update.message.chat.id);
    const senderId = String(update.message.from?.id ?? update.message.chat.id);
    const messageId = update.message.message_id
      ? String(update.message.message_id)
      : `${updateId}`;

    return [
      {
        provider: this.provider,
        providerAccountId: this.botToken.slice(0, 12),
        providerEventId: String(updateId),
        providerMessageId: messageId,
        conversationExternalId: chatId,
        senderExternalId: senderId,
        eventType: 'INBOUND_MESSAGE',
        occurredAt: update.message.date ? new Date(update.message.date * 1000) : new Date(),
        checksum: checksumPayload(input.rawBody),
        idempotencyKey: buildIdempotencyKey([this.provider, String(updateId), chatId]),
        rawPayloadRef: `telegram:${updateId}`,
        messageText: update.message.text,
        rawPayload: {
          ...input.payload,
          updateType: 'message',
        },
        webhookEventKind: 'message',
      },
    ];
  }

  async acknowledgeInboundEvent(input: {
    event: NormalizedInboundEvent;
    correlationId: string;
  }): Promise<void> {
    this.ensureConfigured();
    if (!input.event.callbackQueryId) {
      return;
    }

    const endpoint = `https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': input.correlationId,
      },
      body: JSON.stringify({
        callback_query_id: input.event.callbackQueryId,
      }),
    });

    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || json['ok'] === false) {
      const description = String(json['description'] ?? response.statusText);
      if (response.status >= 500 || response.status === 429) {
        throw new ProviderTransientError(`Telegram callback ack transient error: ${description}`);
      }
      throw new ProviderPermanentError(`Telegram callback ack permanent error: ${description}`);
    }
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
    return this.sendMessage(
      input.recipient,
      {
        body: `Track your Koya order (${input.referenceCode}): ${input.trackingUrl}`,
      },
      input.correlationId,
    );
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
      healthy: this.enabled && Boolean(this.botToken && this.webhookSecret),
      capabilities: ['text', 'tracking_link'],
    };
  }

  private ensureConfigured(): void {
    if (!this.enabled) {
      throw new ProviderPermanentError('Telegram provider is disabled');
    }
    if (!this.botToken || !this.webhookSecret) {
      throw new ProviderPermanentError('Telegram provider is not configured');
    }
  }

  private async sendMessage(
    recipient: string,
    message: ChatOutboundMessage,
    correlationId: string,
  ): Promise<ProviderSendResult> {
    const endpoint = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const payload: Record<string, unknown> = {
      chat_id: recipient,
      text: message.body,
      disable_web_page_preview: true,
    };

    if (message.interactive?.buttons?.length) {
      payload['reply_markup'] = {
        inline_keyboard: message.interactive.buttons.slice(0, 6).map((button) => [
          {
            text: button.title,
            callback_data: button.id.slice(0, 64),
          },
        ]),
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok || json['ok'] === false) {
      const description = String(json['description'] ?? response.statusText);
      if (response.status >= 500 || response.status === 429) {
        throw new ProviderTransientError(`Telegram transient error: ${description}`);
      }
      throw new ProviderPermanentError(`Telegram permanent error: ${description}`);
    }

    const result = (json['result'] as Record<string, unknown>) ?? {};
    const providerMessageId = String(result['message_id'] ?? '');
    if (!providerMessageId) {
      throw new ProviderTransientError('Telegram response missing message_id');
    }

    return {
      success: true,
      providerMessageId,
      channel: message.interactive ? 'quick_reply' : 'text',
    };
  }
}
