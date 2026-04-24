import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSessionService } from '../whatsapp/whatsapp-session.service';
import { WhatsAppParserService } from '../whatsapp/whatsapp-parser.service';
import { WhatsAppTemplateService } from '../whatsapp/whatsapp-template.service';
import { WhatsAppIdempotencyService } from '../whatsapp/whatsapp-idempotency.service';
import { WhatsAppFlowHandler } from '../whatsapp/whatsapp-flow.handler';
import type {
  MessagingProvider,
  WhatsAppConversation,
  MessagingProvider as PrismaMessagingProvider,
} from '@prisma/client';
import type { ChatOutboundMessage, MessagingProviderType } from './messaging.types';
import { ConversionService } from '../conversion/conversion.service';
import { RatesService } from '../rates/rates.service';
import { MessagingProviderRouter } from './messaging-provider.router';
import { MessagingPersistenceService } from './messaging-persistence.service';

@Injectable()
export class ChatConversionFlowService {
  private readonly logger = new Logger(ChatConversionFlowService.name);

  /** Simple in-memory rate limiter: phone → timestamps */
  private readonly rateLimitMap = new Map<string, number[]>();
  private readonly rateLimitPerMinute: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionSvc: WhatsAppSessionService,
    private readonly parser: WhatsAppParserService,
    private readonly templates: WhatsAppTemplateService,
    private readonly idempotency: WhatsAppIdempotencyService,
    private readonly flowHandler: WhatsAppFlowHandler,
    private readonly conversionService: ConversionService,
    private readonly ratesService: RatesService,
    private readonly providerRouter: MessagingProviderRouter,
    private readonly persistence: MessagingPersistenceService,
  ) {
    this.rateLimitPerMinute = parseInt(
      process.env['WHATSAPP_RATE_LIMIT_PER_MINUTE'] ?? '20',
      10,
    );
  }

  async handleInboundMessage(input: {
    provider: MessagingProviderType;
    from: string;
    body: string;
    providerMessageId: string;
    rawPayload?: Record<string, unknown>;
    correlationId?: string;
  }): Promise<void> {
    const correlationId = input.correlationId ?? randomUUID();
    const provider = this.toPrismaProvider(input.provider);

    this.logger.log(
      `[${correlationId}] inbound provider=${input.provider} from=${input.from} messageId=${input.providerMessageId}`,
    );

    if (await this.idempotency.isDuplicate(input.providerMessageId, input.provider)) {
      this.logger.debug(`[${correlationId}] duplicate providerMessageId=${input.providerMessageId}`);
      return;
    }

    if (this.isRateLimited(`${input.provider}:${input.from}`)) {
      await this.sendReply({
        provider: input.provider,
        to: input.from,
        message: this.templates.rateLimited(),
        conversationId: null,
        correlationId,
      });
      return;
    }

    const conversation = await this.sessionSvc.findOrCreateConversation(
      input.from,
      provider,
    );

    await this.prisma.whatsAppMessageEvent.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        providerMessageId: input.providerMessageId,
        provider,
        body: input.body,
        rawPayload: (input.rawPayload as object) ?? null,
      },
    });

    await this.sessionSvc.touchInbound(conversation.id);

    if (this.sessionSvc.isExpired(conversation) && conversation.currentStep !== 'IDLE') {
      this.logger.log(`[${correlationId}] conversation expired id=${conversation.id}`);
      await this.sessionSvc.setStatus(conversation.id, 'EXPIRED');
      const newConv = await this.sessionSvc.createConversation(input.from, provider);
      await this.sendReply({
        provider: input.provider,
        to: input.from,
        message: this.templates.sessionExpired(input.provider),
        conversationId: newConv.id,
        correlationId,
      });
      return;
    }

    const command = this.parser.parseCommand({
      body: input.body,
      buttonText: typeof input.rawPayload?.['buttonText'] === 'string' ? (input.rawPayload?.['buttonText'] as string) : undefined,
      buttonPayload:
        typeof input.rawPayload?.['buttonPayload'] === 'string' ? (input.rawPayload?.['buttonPayload'] as string) : undefined,
    });

    const globalReply = await this.handleGlobalCommand(conversation, command);
    if (globalReply) {
      await this.sendReply({
        provider: input.provider,
        to: input.from,
        message: globalReply,
        conversationId: conversation.id,
        correlationId,
      });
      return;
    }

    let reply: ChatOutboundMessage;
    try {
      reply = await this.flowHandler.handle(conversation, command);
    } catch (error) {
      this.logger.error(`[${correlationId}] flow handler error`, error as Error);
      reply = this.templates.errorMessage(
        input.provider === 'TELEGRAM'
          ? 'Something went wrong. Tap Help or send /start.'
          : 'Something went wrong. Reply *HELP* for commands.',
      );
    }

    await this.sendReply({
      provider: input.provider,
      to: input.from,
      message: reply,
      conversationId: conversation.id,
      correlationId,
    });

    await this.trySendTerminalTrackingLink({
      provider: input.provider,
      conversation,
      to: input.from,
      correlationId,
    });
  }

  async sendCompletionNotification(conversionSessionId: string): Promise<void> {
    const conversation = await this.sessionSvc.findBySessionId(conversionSessionId);
    if (!conversation) {
      this.logger.debug(`No conversation for session ${conversionSessionId}`);
      return;
    }

    const provider = this.fromPrismaProvider(conversation.provider);
    const correlationId = randomUUID();

    try {
      const status = await this.conversionService.getStatus(conversionSessionId);
      const message = this.templates.paymentSuccess({
        guestRef: status.guestRef ?? '',
        txHash: status.txHash ?? null,
        btcAmount: status.targetAmount,
        referenceCode: status.referenceCode,
      });

      await this.sessionSvc.updateStep(conversation.id, 'COMPLETED');
      await this.sessionSvc.setStatus(conversation.id, 'COMPLETED');

      await this.sendReply({
        provider,
        to: conversation.phoneNumber,
        message,
        conversationId: conversation.id,
        correlationId,
      });

      await this.sendTrackingLink({
        provider,
        recipient: conversation.phoneNumber,
        conversationId: conversation.id,
        conversionSessionId,
        referenceCode: status.referenceCode,
        correlationId,
      });
    } catch (error) {
      this.logger.error(
        `[${correlationId}] failed completion notification session=${conversionSessionId}`,
        error as Error,
      );
    }
  }

  private async handleGlobalCommand(
    conversation: WhatsAppConversation,
    command: ReturnType<WhatsAppParserService['parseCommand']>,
  ): Promise<ChatOutboundMessage | null> {
    const provider = this.fromPrismaProvider(conversation.provider);

    switch (command.type) {
      case 'GREETING':
        if (provider === 'TELEGRAM') {
          await this.sessionSvc.updateStep(conversation.id, 'MENU');
          return this.templates.welcomeMenu(provider);
        }
        return null;

      case 'START_CONVERSION':
        await this.sessionSvc.resetConversation(conversation.id);
        await this.sessionSvc.updateStep(conversation.id, 'WAITING_FOR_AMOUNT');
        return this.templates.askAmount(provider);

      case 'BACK':
        await this.sessionSvc.updateStep(conversation.id, 'MENU');
        return this.templates.welcomeMenu(provider);

      case 'HELP':
        return this.templates.helpMessage(provider);

      case 'TRANSACTIONS':
        return this.templates.transactionsOverview(provider);

      case 'RATES': {
        try {
          const rates = await this.ratesService.getAllRates();
          return this.templates.showRates(rates, provider);
        } catch {
          return this.templates.errorMessage('Could not fetch live rates right now.');
        }
      }

      case 'CANCEL':
        if (conversation.currentStep !== 'IDLE' && conversation.currentStep !== 'COMPLETED') {
          await this.sessionSvc.resetConversation(conversation.id);
          return this.templates.cancelConfirmation(provider);
        }
        return this.templates.welcomeMenu(provider);

      case 'START_OVER':
        await this.sessionSvc.setStatus(conversation.id, 'CANCELLED');
        await this.sessionSvc.createConversation(conversation.phoneNumber, conversation.provider);
        return this.templates.welcomeMenu(provider);

      case 'STATUS':
        if (conversation.conversionSessionId) {
          try {
            const status = await this.conversionService.getStatus(
              conversation.conversionSessionId,
            );
            return this.templates.conversionStatus(status, provider);
          } catch {
            return this.templates.errorMessage('Could not retrieve status.');
          }
        }
        return this.templates.trackOrderPrompt(provider);

      default:
        return null;
    }
  }

  private async sendReply(input: {
    provider: MessagingProviderType;
    to: string;
    message: ChatOutboundMessage;
    conversationId: string | null;
    correlationId: string;
  }): Promise<void> {
    const provider = this.providerRouter.getProvider(input.provider);

    try {
      const result = input.message.interactive
        ? await provider.sendTemplateMessage({
            recipient: input.to,
            message: input.message,
            correlationId: input.correlationId,
          })
        : await provider.sendTextMessage({
            recipient: input.to,
            message: input.message,
            correlationId: input.correlationId,
          });

      if (input.conversationId) {
        await this.prisma.whatsAppMessageEvent.create({
          data: {
            conversationId: input.conversationId,
            direction: 'OUTBOUND',
            providerMessageId: result.providerMessageId,
            provider: this.toPrismaProvider(input.provider),
            body: input.message.body,
            rawPayload: {
              channel: result.channel ?? 'text',
              providerTemplateId: result.providerTemplateId ?? null,
              buttonPayloads:
                input.message.interactive?.buttons.map((button) => button.id) ?? [],
            },
          },
        });
        await this.sessionSvc.touchOutbound(input.conversationId);
      }

      if (input.message.interactive) {
        await this.persistence.recordTemplateDispatch({
          provider: this.toPrismaProvider(input.provider),
          conversationId: input.conversationId ?? undefined,
          templateKey: input.message.interactive.templateKey,
          providerTemplateId: result.providerTemplateId ?? null,
          providerMessageId: result.providerMessageId,
          correlationId: input.correlationId,
          payloadJson: {
            body: input.message.body,
            buttons: input.message.interactive.buttons,
          },
        });
      }
    } catch (error) {
      const classification = provider.classifyError(error);
      this.logger.error(
        `[${input.correlationId}] failed to send reply provider=${input.provider} to=${input.to} retryable=${classification.retryable} reason=${classification.reason}`,
        error as Error,
      );
      throw error;
    }
  }

  private async trySendTerminalTrackingLink(input: {
    provider: MessagingProviderType;
    conversation: WhatsAppConversation;
    to: string;
    correlationId: string;
  }): Promise<void> {
    if (!input.conversation.conversionSessionId) {
      return;
    }

    const status = await this.conversionService
      .getStatus(input.conversation.conversionSessionId)
      .catch(() => null);

    if (!status) {
      return;
    }

    const terminal = new Set(['COMPLETED', 'FAILED', 'MANUAL_REVIEW', 'EXPIRED']);
    if (!terminal.has(status.currentState)) {
      return;
    }

    await this.sendTrackingLink({
      provider: input.provider,
      recipient: input.to,
      conversationId: input.conversation.id,
      conversionSessionId: input.conversation.conversionSessionId,
      referenceCode: status.referenceCode,
      correlationId: input.correlationId,
    });
  }

  private async sendTrackingLink(input: {
    provider: MessagingProviderType;
    recipient: string;
    conversationId?: string;
    conversionSessionId?: string;
    referenceCode: string;
    correlationId: string;
  }): Promise<void> {
    const provider = this.providerRouter.getProvider(input.provider);
    const trackingUrl = this.templates.getTrackingUrl(input.referenceCode);

    try {
      const result = await provider.sendTrackingLink({
        recipient: input.recipient,
        trackingUrl,
        referenceCode: input.referenceCode,
        correlationId: input.correlationId,
      });

      await this.persistence.recordTrackingLinkDispatch({
        provider: this.toPrismaProvider(input.provider),
        conversationId: input.conversationId,
        conversionSessionId: input.conversionSessionId,
        referenceCode: input.referenceCode,
        trackingUrl,
        providerMessageId: result.providerMessageId,
        correlationId: input.correlationId,
      });
    } catch (error) {
      this.logger.error(
        `[${input.correlationId}] failed to send tracking link ref=${input.referenceCode}`,
        error as Error,
      );

      await this.persistence.recordTrackingLinkDispatch({
        provider: this.toPrismaProvider(input.provider),
        conversationId: input.conversationId,
        conversionSessionId: input.conversionSessionId,
        referenceCode: input.referenceCode,
        trackingUrl,
        providerMessageId: null,
        correlationId: input.correlationId,
        status: 'FAILED',
      });
    }
  }

  private toPrismaProvider(provider: MessagingProviderType): PrismaMessagingProvider {
    return provider as PrismaMessagingProvider;
  }

  private fromPrismaProvider(provider: MessagingProvider): MessagingProviderType {
    return provider as MessagingProviderType;
  }

  private isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowMs = 60_000;
    const timestamps = this.rateLimitMap.get(key) ?? [];

    const recent = timestamps.filter((t) => now - t < windowMs);
    recent.push(now);
    this.rateLimitMap.set(key, recent);

    return recent.length > this.rateLimitPerMinute;
  }
}
