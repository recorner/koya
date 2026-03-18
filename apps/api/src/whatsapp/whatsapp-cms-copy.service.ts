import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDirectus, readItems, rest, staticToken } from '@directus/sdk';
import type { WhatsAppQuickReplyButton } from '../providers/twilio-adapter.interface';

type TemplateTokenValue = string | number | boolean | null | undefined;

export interface WhatsAppTemplateDefinition {
  id?: string | number;
  key: string;
  body: string;
  buttons: WhatsAppQuickReplyButton[] | null;
  twilioContentSid?: string | null;
  twilioContentHash?: string | null;
}

interface WhatsAppTemplateRecord {
  id?: string | number;
  key: string;
  body: string | null;
  buttons_json?: unknown;
  twilio_content_sid?: string | null;
  twilio_content_hash?: string | null;
  is_active?: boolean | null;
}

@Injectable()
export class WhatsAppCmsCopyService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppCmsCopyService.name);
  private readonly cache = new Map<string, WhatsAppTemplateDefinition>();
  private readonly enabled: boolean;
  private readonly cacheTtlMs: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: any;

  private refreshPromise: Promise<void> | null = null;
  private lastLoadedAt = 0;
  private hasWarned = false;

  constructor(private readonly config: ConfigService) {
    const directusUrl = this.config.get<string>('DIRECTUS_URL', '').trim();
    const directusToken = this.config
      .get<string>('DIRECTUS_TOKEN', '')
      .trim();
    const ttlSeconds = parseInt(
      this.config.get<string>('WHATSAPP_TEMPLATE_CACHE_TTL_SECONDS', '60'),
      10,
    );

    this.enabled = Boolean(directusUrl && directusToken);
    this.cacheTtlMs =
      Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds * 1000 : 60_000;

    this.client = this.enabled
      ? createDirectus(directusUrl).with(staticToken(directusToken)).with(rest())
      : null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.refreshTemplates();
  }

  render(
    key: string,
    fallback: string,
    tokens: Record<string, TemplateTokenValue> = {},
  ): string {
    const template = this.getTemplate(key);
    return this.interpolate(template?.body ?? fallback, tokens);
  }

  getTemplate(key: string): WhatsAppTemplateDefinition | null {
    this.refreshTemplatesIfStale();
    return this.cache.get(key) ?? null;
  }

  private refreshTemplatesIfStale(): void {
    if (!this.enabled) {
      return;
    }

    if (Date.now() - this.lastLoadedAt < this.cacheTtlMs) {
      return;
    }

    void this.refreshTemplates();
  }

  private async refreshTemplates(): Promise<void> {
    const client = this.client;
    if (!this.enabled || !client) {
      return;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const records = (await client.request(
          readItems('whatsapp_message_templates' as never, {
            fields: [
              'id',
              'key',
              'body',
              'buttons_json',
              'twilio_content_sid',
              'twilio_content_hash',
              'is_active',
            ],
            filter: {
              is_active: {
                _neq: false,
              },
            },
            limit: -1,
          } as never),
        )) as WhatsAppTemplateRecord[];

        const nextCache = new Map<string, WhatsAppTemplateDefinition>();

        for (const record of records) {
          if (!record.key || !record.body) {
            continue;
          }

          nextCache.set(record.key, {
            id: record.id,
            key: record.key,
            body: record.body,
            buttons: this.parseButtons(record.buttons_json),
            twilioContentSid: record.twilio_content_sid ?? null,
            twilioContentHash: record.twilio_content_hash ?? null,
          });
        }

        this.cache.clear();
        nextCache.forEach((value, key) => this.cache.set(key, value));
        this.hasWarned = false;
      } catch (error) {
        if (!this.hasWarned) {
          this.logger.warn(
            'Failed to load WhatsApp copy from Directus. Using bundled defaults.',
          );
          this.hasWarned = true;
        }

        this.logger.debug(`${error}`);
      } finally {
        this.lastLoadedAt = Date.now();
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private interpolate(
    template: string,
    tokens: Record<string, TemplateTokenValue>,
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(tokens)) {
      const safeValue = value == null ? '' : String(value);
      result = result.replace(
        new RegExp(`{{\\s*${this.escapeRegex(key)}\\s*}}`, 'g'),
        safeValue,
      );
    }

    return result.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private parseButtons(value: unknown): WhatsAppQuickReplyButton[] | null {
    if (value == null) {
      return null;
    }

    const parsed = typeof value === 'string' ? this.parseJson(value) : value;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed
      .filter(
        (entry): entry is { id?: unknown; title?: unknown } =>
          typeof entry === 'object' && entry !== null,
      )
      .map((entry) => ({
        id: String(entry.id ?? '').trim(),
        title: String(entry.title ?? '').trim(),
      }))
      .filter((entry) => entry.id.length > 0 && entry.title.length > 0)
      .slice(0, 3);
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}
