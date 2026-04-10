import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

/**
 * WhatsApp CMS copy service.
 *
 * Previously loaded templates from Directus. Now operates with bundled
 * defaults only — templates are defined in code (no external CMS dependency).
 */
@Injectable()
export class WhatsAppCmsCopyService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppCmsCopyService.name);
  private readonly cache = new Map<string, WhatsAppTemplateDefinition>();

  constructor(private readonly config: ConfigService) {
    // No external CMS needed — uses bundled defaults
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('WhatsApp CMS copy service initialized (bundled defaults)');
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
    return this.cache.get(key) ?? null;
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
}
