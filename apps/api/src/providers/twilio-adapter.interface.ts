export interface WhatsAppQuickReplyButton {
  id: string;
  title: string;
}

export interface WhatsAppInteractiveTemplate {
  templateKey: string;
  directusItemId?: string | number | null;
  bodyTemplate: string;
  buttons: WhatsAppQuickReplyButton[];
  contentSid?: string | null;
  contentSignature?: string | null;
}

export interface WhatsAppOutboundMessage {
  body: string;
  variables?: Record<string, string>;
  interactive?: WhatsAppInteractiveTemplate;
}

/** Twilio WhatsApp messaging abstraction */
export interface TwilioAdapter {
  sendMessage(
    to: string,
    message: WhatsAppOutboundMessage,
  ): Promise<TwilioSendResult>;
  validateRequest(
    signature: string,
    url: string,
    params: Record<string, string>,
  ): boolean;
}

export interface TwilioSendResult {
  success: boolean;
  messageSid: string;
  contentSid?: string | null;
  channel?: 'text' | 'quick_reply';
}

export const TWILIO_ADAPTER = 'TWILIO_ADAPTER';
