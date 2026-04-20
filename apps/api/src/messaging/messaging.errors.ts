export class WebhookSignatureError extends Error {
  constructor(message = 'Webhook signature verification failed') {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

export class PayloadValidationError extends Error {
  constructor(message = 'Webhook payload validation failed') {
    super(message);
    this.name = 'PayloadValidationError';
  }
}

export class DuplicateEventError extends Error {
  constructor(message = 'Duplicate inbound event') {
    super(message);
    this.name = 'DuplicateEventError';
  }
}

export class ProviderTransientError extends Error {
  constructor(message = 'Transient provider error') {
    super(message);
    this.name = 'ProviderTransientError';
  }
}

export class ProviderPermanentError extends Error {
  constructor(message = 'Permanent provider error') {
    super(message);
    this.name = 'ProviderPermanentError';
  }
}

export class ConversationStateError extends Error {
  constructor(message = 'Conversation state is invalid') {
    super(message);
    this.name = 'ConversationStateError';
  }
}

export class TrackingLinkGenerationError extends Error {
  constructor(message = 'Could not generate tracking link') {
    super(message);
    this.name = 'TrackingLinkGenerationError';
  }
}
