import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

/**
 * Twilio sends form-urlencoded data. NestJS handles this via
 * the built-in urlencoded body parser when Content-Type
 * is application/x-www-form-urlencoded.
 */
interface TwilioWebhookBody {
  Body?: string;
  From: string;
  To: string;
  MessageSid: string;
  NumMedia?: string;
  ButtonText?: string;
  ButtonPayload?: string;
  [key: string]: string | undefined;
}

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly whatsappService: WhatsAppService) {}

  /**
   * POST /api/v1/whatsapp/webhook
   * Handles inbound Twilio WhatsApp messages
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() payload: TwilioWebhookBody): Promise<string> {
    const from = payload.From?.replace('whatsapp:', '') ?? '';
    const body = payload.Body ?? payload.ButtonText ?? '';
    const messageSid = payload.MessageSid ?? '';

    if (!from || !messageSid) {
      this.logger.warn('Invalid webhook payload: missing From or MessageSid');
      return '<Response></Response>';
    }

    // Process asynchronously — return TwiML empty response immediately
    // We send replies via REST API, not TwiML
    this.whatsappService
      .handleInboundMessage(from, body, messageSid, payload as unknown as Record<string, string>)
      .catch((error) => {
        this.logger.error(`Webhook processing error: ${error}`);
      });

    return '<Response></Response>';
  }
}
