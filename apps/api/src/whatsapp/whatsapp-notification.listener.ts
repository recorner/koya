import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WhatsAppService } from './whatsapp.service';

export interface ConversionCompletedEvent {
  sessionId: string;
  channel: string;
}

@Injectable()
export class WhatsAppNotificationListener {
  private readonly logger = new Logger(WhatsAppNotificationListener.name);

  constructor(private readonly whatsappService: WhatsAppService) {}

  @OnEvent('conversion.completed')
  async handleConversionCompleted(event: ConversionCompletedEvent): Promise<void> {
    if (event.channel !== 'WHATSAPP') {
      return;
    }

    this.logger.log(
      `Conversion completed for WhatsApp session ${event.sessionId}, sending notification`,
    );

    await this.whatsappService.sendCompletionNotification(event.sessionId);
  }
}
