import type {
  ChatOutboundMessage,
  MessagingProviderType,
  NormalizedInboundEvent,
  ProviderHealthMetadata,
  ProviderSendResult,
  RetryClassification,
} from '../messaging.types';

export interface MessagingWebhookVerifier {
  verifyWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: string;
    query?: Record<string, string | string[] | undefined>;
  }): void;

  verifyChallenge?(input: {
    query: Record<string, string | string[] | undefined>;
  }): { accepted: boolean; challenge?: string };
}

export interface MessagingInboundNormalizer {
  normalizeInbound(input: {
    headers: Record<string, string | string[] | undefined>;
    payload: Record<string, unknown>;
    rawBody: string;
  }): NormalizedInboundEvent[];
}

export interface MessagingTemplateSender {
  sendTemplateMessage(input: {
    recipient: string;
    message: ChatOutboundMessage;
    correlationId: string;
  }): Promise<ProviderSendResult>;
}

export interface MessagingProvider
  extends MessagingWebhookVerifier,
    MessagingInboundNormalizer,
    MessagingTemplateSender {
  readonly provider: MessagingProviderType;

  sendTextMessage(input: {
    recipient: string;
    message: ChatOutboundMessage;
    correlationId: string;
  }): Promise<ProviderSendResult>;

  sendTrackingLink(input: {
    recipient: string;
    trackingUrl: string;
    referenceCode: string;
    correlationId: string;
  }): Promise<ProviderSendResult>;

  classifyError(error: unknown): RetryClassification;
  healthMetadata(): ProviderHealthMetadata;
}

export const MESSAGING_PROVIDERS = 'MESSAGING_PROVIDERS';
