import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Twilio } from 'twilio';
import { validateRequest } from 'twilio';
import type {
  TwilioAdapter,
  TwilioSendResult,
  WhatsAppInteractiveTemplate,
  WhatsAppOutboundMessage,
} from './twilio-adapter.interface';

@Injectable()
export class RealTwilioAdapter implements TwilioAdapter {
  private readonly logger = new Logger(RealTwilioAdapter.name);
  private readonly client: Twilio;
  private readonly accountSid: string;
  private readonly fromNumber: string;
  private readonly authToken: string;
  private readonly contentCache = new Map<
    string,
    { signature: string; contentSid: string }
  >();

  constructor(private readonly config: ConfigService) {
    this.accountSid = this.config.getOrThrow<string>('TWILIO_ACCOUNT_SID');
    this.authToken = this.config.getOrThrow<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.config.getOrThrow<string>('TWILIO_WHATSAPP_NUMBER');
    this.client = new Twilio(this.accountSid, this.authToken);
  }

  async sendMessage(
    to: string,
    outbound: WhatsAppOutboundMessage,
  ): Promise<TwilioSendResult> {
    if (outbound.interactive && outbound.interactive.buttons.length > 0) {
      const interactive = await this.prepareInteractiveTemplate(outbound);
      const message = await this.client.messages.create({
        from: this.fromNumber,
        to: `whatsapp:${to}`,
        contentSid: interactive.contentSid,
        contentVariables:
          Object.keys(interactive.variables).length > 0
            ? JSON.stringify(interactive.variables)
            : undefined,
      });

      this.logger.log(
        `Sent interactive WhatsApp to ${to}: SID=${message.sid} ContentSid=${interactive.contentSid}`,
      );
      return {
        success: true,
        messageSid: message.sid,
        contentSid: interactive.contentSid,
        channel: 'quick_reply',
      };
    }

    const message = await this.client.messages.create({
      from: this.fromNumber,
      to: `whatsapp:${to}`,
      body: outbound.body,
    });

    this.logger.log(`Sent WhatsApp to ${to}: SID=${message.sid}`);
    return { success: true, messageSid: message.sid, channel: 'text' };
  }

  validateRequest(
    signature: string,
    url: string,
    params: Record<string, string>,
  ): boolean {
    return validateRequest(this.authToken, signature, url, params);
  }

  private async prepareInteractiveTemplate(
    outbound: WhatsAppOutboundMessage,
  ): Promise<{ contentSid: string; variables: Record<string, string> }> {
    const interactive = outbound.interactive;
    if (!interactive) {
      throw new Error('Interactive template metadata is missing.');
    }

    const signature = this.computeSignature(interactive);
    const cached = this.contentCache.get(interactive.templateKey);
    if (cached && cached.signature === signature) {
      return {
        contentSid: cached.contentSid,
        variables: this.normalizeVariables(outbound.variables),
      };
    }

    if (
      interactive.contentSid &&
      interactive.contentSignature &&
      interactive.contentSignature === signature
    ) {
      this.contentCache.set(interactive.templateKey, {
        signature,
        contentSid: interactive.contentSid,
      });
      return {
        contentSid: interactive.contentSid,
        variables: this.normalizeVariables(outbound.variables),
      };
    }

    const content = await this.client.content.v1.contents.create({
      friendlyName: this.buildFriendlyName(interactive.templateKey),
      language: 'en',
      variables: this.buildDefaultVariables(interactive.bodyTemplate),
      types: {
        'twilio/quick-reply': {
          body: interactive.bodyTemplate,
          actions: interactive.buttons.map((button) => ({
            id: button.id,
            title: button.title,
          })),
        },
      } as Record<string, object>,
    });

    this.contentCache.set(interactive.templateKey, {
      signature,
      contentSid: content.sid,
    });
    await this.persistInteractiveTemplate(interactive, content.sid, signature);

    return {
      contentSid: content.sid,
      variables: this.normalizeVariables(outbound.variables),
    };
  }

  private normalizeVariables(
    variables: Record<string, string> | undefined,
  ): Record<string, string> {
    if (!variables) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(variables).map(([key, value]) => [key, String(value)]),
    );
  }

  private computeSignature(interactive: WhatsAppInteractiveTemplate): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          bodyTemplate: interactive.bodyTemplate,
          buttons: interactive.buttons,
        }),
      )
      .digest('hex');
  }

  private buildFriendlyName(templateKey: string): string {
    const timestamp = Date.now();
    return `koya_${templateKey}_${timestamp}`.slice(0, 64);
  }

  private buildDefaultVariables(bodyTemplate: string): Record<string, string> {
    const matches = bodyTemplate.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) ?? [];
    const keys = new Set<string>();

    for (const match of matches) {
      const key = match.replace(/[{}]/g, '').trim();
      if (key) {
        keys.add(key);
      }
    }

    return Object.fromEntries(
      Array.from(keys).map((key) => [key, this.sampleValueForVariable(key)]),
    );
  }

  private sampleValueForVariable(key: string): string {
    return key
      .split('_')
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private async persistInteractiveTemplate(
    interactive: WhatsAppInteractiveTemplate,
    contentSid: string,
    signature: string,
  ): Promise<void> {
    // No-op: Directus persistence removed. Content SID is cached in-memory only.
    this.logger.debug(
      `Skipping persistence for template ${interactive.templateKey} (contentSid=${contentSid})`,
    );
  }
}
