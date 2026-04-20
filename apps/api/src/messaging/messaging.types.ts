export type MessagingProviderType = 'WHATSAPP_CLOUD' | 'TELEGRAM';

export type MessagingEventType =
  | 'INBOUND_MESSAGE'
  | 'PROVIDER_STATUS'
  | 'SYSTEM';

export interface ChatQuickReplyButton {
  id: string;
  title: string;
}

// Backward-compatible aliases for existing flow/template services.
export type WhatsAppQuickReplyButton = ChatQuickReplyButton;

export interface ChatInteractiveTemplate {
  templateKey: string;
  cmsItemId?: string | number | null;
  bodyTemplate: string;
  buttons: ChatQuickReplyButton[];
  providerTemplateId?: string | null;
  providerTemplateSignature?: string | null;
}

export type WhatsAppInteractiveTemplate = ChatInteractiveTemplate;

export interface ChatOutboundMessage {
  body: string;
  variables?: Record<string, string>;
  interactive?: ChatInteractiveTemplate;
}

export type WhatsAppOutboundMessage = ChatOutboundMessage;

export interface NormalizedInboundEvent {
  provider: MessagingProviderType;
  providerAccountId: string | null;
  providerEventId: string;
  providerMessageId: string | null;
  conversationExternalId: string;
  senderExternalId: string;
  eventType: MessagingEventType;
  occurredAt: Date;
  checksum: string;
  idempotencyKey: string;
  rawPayloadRef: string;
  messageText: string;
  rawPayload: Record<string, unknown>;
}

export interface ProviderSendResult {
  success: boolean;
  providerMessageId: string;
  providerTemplateId?: string | null;
  channel?: 'text' | 'quick_reply';
}

export interface ProviderHealthMetadata {
  provider: MessagingProviderType;
  healthy: boolean;
  capabilities: string[];
}

export type RetryClassification =
  | { retryable: true; reason: string; suggestedDelayMs?: number }
  | { retryable: false; reason: string };
