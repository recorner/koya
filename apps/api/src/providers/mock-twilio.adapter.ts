import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  TwilioAdapter,
  TwilioSendResult,
  WhatsAppOutboundMessage,
} from './twilio-adapter.interface';

@Injectable()
export class MockTwilioAdapter implements TwilioAdapter {
  private readonly logger = new Logger(MockTwilioAdapter.name);
  public readonly sentMessages: Array<{
    to: string;
    body: string;
    sid: string;
    contentSid?: string | null;
    channel: 'text' | 'quick_reply';
  }> = [];

  async sendMessage(
    to: string,
    message: WhatsAppOutboundMessage,
  ): Promise<TwilioSendResult> {
    const sid = `MOCK-SM-${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const channel = message.interactive ? 'quick_reply' : 'text';
    const contentSid = message.interactive
      ? `MOCK-HX-${randomUUID().replace(/-/g, '').slice(0, 16)}`
      : null;

    this.sentMessages.push({
      to,
      body: message.body,
      sid,
      contentSid,
      channel,
    });
    this.logger.debug(
      `[MOCK] WhatsApp → ${to}: "${message.body.slice(0, 80)}..." SID=${sid}`,
    );
    return { success: true, messageSid: sid, contentSid, channel };
  }

  validateRequest(): boolean {
    return true; // Always valid in mock mode
  }
}
