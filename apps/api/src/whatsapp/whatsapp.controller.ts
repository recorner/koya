import { Controller, GoneException, Post } from '@nestjs/common';

@Controller('whatsapp')
export class WhatsAppController {
  @Post('webhook')
  async handleDeprecatedWebhook(): Promise<void> {
    throw new GoneException(
      'Legacy webhook path removed. Use /api/v1/messaging/webhooks/whatsapp-cloud instead.',
    );
  }
}
