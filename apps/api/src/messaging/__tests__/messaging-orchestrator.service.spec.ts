import { MessagingOrchestratorService } from '../messaging-orchestrator.service';
import type { MessagingProviderRouter } from '../messaging-provider.router';
import type { MessagingPersistenceService } from '../messaging-persistence.service';
import type { ChatConversionFlowService } from '../chat-conversion-flow.service';
import type { MessagingProvider } from '../providers/messaging-provider.interface';
import { ProviderPermanentError, ProviderTransientError } from '../messaging.errors';

describe('MessagingOrchestratorService', () => {
  const provider: MessagingProvider = {
    provider: 'WHATSAPP_CLOUD',
    verifyWebhook: jest.fn(),
    verifyChallenge: jest.fn().mockReturnValue({ accepted: false }),
    normalizeInbound: jest.fn().mockReturnValue([
      {
        provider: 'WHATSAPP_CLOUD',
        providerAccountId: 'acct-1',
        providerEventId: 'ev-1',
        providerMessageId: 'msg-1',
        conversationExternalId: '+254700000001',
        senderExternalId: '+254700000001',
        eventType: 'INBOUND_MESSAGE',
        occurredAt: new Date(),
        checksum: 'sum',
        idempotencyKey: 'idem-1',
        rawPayloadRef: 'raw-1',
        messageText: 'hello',
        rawPayload: { text: 'hello' },
      },
    ]),
    sendTextMessage: jest.fn(),
    sendTemplateMessage: jest.fn(),
    sendTrackingLink: jest.fn(),
    classifyError: jest.fn().mockReturnValue({ retryable: true, reason: 'transient' }),
    healthMetadata: jest.fn().mockReturnValue({
      provider: 'WHATSAPP_CLOUD',
      healthy: true,
      capabilities: ['text'],
    }),
  };

  const providerRouter = {
    getProvider: jest.fn().mockReturnValue(provider),
  } as unknown as MessagingProviderRouter;

  const persistence = {
    storeInboundEvent: jest.fn().mockResolvedValue({ created: true, eventId: 'event-1' }),
    markProcessed: jest.fn(),
    createDeliveryAttempt: jest.fn(),
    markFailedWithRetry: jest.fn(),
    createDeadLetter: jest.fn(),
    findDueRetries: jest.fn().mockResolvedValue([]),
    getEventById: jest.fn(),
  } as unknown as MessagingPersistenceService;

  const chatFlow = {
    handleInboundMessage: jest.fn(),
  } as unknown as ChatConversionFlowService;

  it('marks event as processed on success', async () => {
    const orchestrator = new MessagingOrchestratorService(
      providerRouter,
      persistence,
      chatFlow,
    );

    await orchestrator.handleWebhook({
      provider: 'WHATSAPP_CLOUD',
      headers: {},
      payload: { any: 'value' },
      rawBody: '{}',
    });

    expect((persistence.markProcessed as jest.Mock)).toHaveBeenCalledWith('event-1');
    expect((persistence.createDeadLetter as jest.Mock)).not.toHaveBeenCalled();
  });

  it('dead-letters permanent failures', async () => {
    (chatFlow.handleInboundMessage as jest.Mock).mockRejectedValueOnce(
      new ProviderPermanentError('bad request'),
    );

    const orchestrator = new MessagingOrchestratorService(
      providerRouter,
      persistence,
      chatFlow,
    );

    await orchestrator.handleWebhook({
      provider: 'WHATSAPP_CLOUD',
      headers: {},
      payload: { any: 'value' },
      rawBody: '{}',
    });

    expect((persistence.createDeadLetter as jest.Mock)).toHaveBeenCalled();
  });

  it('schedules retry for transient failures', async () => {
    (chatFlow.handleInboundMessage as jest.Mock).mockRejectedValueOnce(
      new ProviderTransientError('timeout'),
    );

    const orchestrator = new MessagingOrchestratorService(
      providerRouter,
      persistence,
      chatFlow,
    );

    await orchestrator.handleWebhook({
      provider: 'WHATSAPP_CLOUD',
      headers: {},
      payload: { any: 'value' },
      rawBody: '{}',
    });

    const updateArgs = (persistence.markFailedWithRetry as jest.Mock).mock.calls.at(-1)?.[0];
    expect(updateArgs?.nextRetryAt).toBeInstanceOf(Date);
  });

  it('sends visible fallback message when Telegram callback processing fails', async () => {
    const telegramProvider: MessagingProvider = {
      ...provider,
      provider: 'TELEGRAM',
      normalizeInbound: jest.fn().mockReturnValue([
        {
          provider: 'TELEGRAM',
          providerAccountId: 'acct-1',
          providerEventId: 'ev-cb-1',
          providerMessageId: 'msg-cb-1',
          conversationExternalId: '7904666227',
          senderExternalId: '7904666227',
          eventType: 'INBOUND_MESSAGE',
          occurredAt: new Date(),
          checksum: 'sum',
          idempotencyKey: 'idem-cb-1',
          rawPayloadRef: 'raw-cb-1',
          messageText: 'menu:transactions',
          rawPayload: { buttonPayload: 'menu:transactions' },
          webhookEventKind: 'callback_query',
          callbackQueryId: 'cb_1',
        },
      ]),
      sendTextMessage: jest.fn().mockResolvedValue({
        success: true,
        providerMessageId: 'fallback-1',
      }),
    };

    const telegramRouter = {
      getProvider: jest.fn().mockReturnValue(telegramProvider),
    } as unknown as MessagingProviderRouter;

    (chatFlow.handleInboundMessage as jest.Mock).mockRejectedValueOnce(
      new ProviderTransientError('temporary failure'),
    );

    const orchestrator = new MessagingOrchestratorService(
      telegramRouter,
      persistence,
      chatFlow,
    );

    await orchestrator.handleWebhook({
      provider: 'TELEGRAM',
      headers: {},
      payload: { any: 'value' },
      rawBody: '{}',
    });

    expect(telegramProvider.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '7904666227',
        message: expect.objectContaining({
          body: expect.stringContaining('button tap'),
        }),
      }),
    );
  });
});
