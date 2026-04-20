import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatConversionFlowService } from './chat-conversion-flow.service';

export interface ConversionCompletedEvent {
  sessionId: string;
  channel: string;
}

@Injectable()
export class ConversionNotificationListener {
  private readonly logger = new Logger(ConversionNotificationListener.name);

  constructor(private readonly chatFlow: ChatConversionFlowService) {}

  @OnEvent('conversion.completed')
  async handleConversionCompleted(event: ConversionCompletedEvent): Promise<void> {
    if (event.channel !== 'WHATSAPP' && event.channel !== 'TELEGRAM') {
      return;
    }

    this.logger.log(
      `Conversion completed for chat session ${event.sessionId}, sending chat notification`,
    );

    await this.chatFlow.sendCompletionNotification(event.sessionId);
  }
}
