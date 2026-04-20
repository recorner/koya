import { Injectable } from '@nestjs/common';
import { ChatConversionFlowService } from '../messaging/chat-conversion-flow.service';

@Injectable()
export class WhatsAppService {
  constructor(private readonly chatFlow: ChatConversionFlowService) {}

  async handleInboundMessage(
    from: string,
    body: string,
    messageId: string,
    rawPayload?: Record<string, unknown>,
  ): Promise<void> {
    await this.chatFlow.handleInboundMessage({
      provider: 'WHATSAPP_CLOUD',
      from,
      body,
      providerMessageId: messageId,
      rawPayload,
    });
  }

  async sendCompletionNotification(conversionSessionId: string): Promise<void> {
    await this.chatFlow.sendCompletionNotification(conversionSessionId);
  }
}
