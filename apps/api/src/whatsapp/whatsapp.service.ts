import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSessionService } from './whatsapp-session.service';
import { WhatsAppParserService } from './whatsapp-parser.service';
import { WhatsAppTemplateService } from './whatsapp-template.service';
import { WhatsAppIdempotencyService } from './whatsapp-idempotency.service';
import { WhatsAppFlowHandler } from './whatsapp-flow.handler';
import { TWILIO_ADAPTER } from '../providers/twilio-adapter.interface';
import type {
  TwilioAdapter,
  WhatsAppOutboundMessage,
} from '../providers/twilio-adapter.interface';
import { ConversionService } from '../conversion/conversion.service';
import { RatesService } from '../rates/rates.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

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
    @Inject(TWILIO_ADAPTER) private readonly twilio: TwilioAdapter,
  ) {
    this.rateLimitPerMinute = parseInt(
      process.env['WHATSAPP_RATE_LIMIT_PER_MINUTE'] ?? '20',
      10,
    );
  }

  /**
   * Main entry point for handling an inbound WhatsApp message
   */
  async handleInboundMessage(
    from: string,
    body: string,
    messageSid: string,
    rawPayload?: Record<string, string>,
  ): Promise<void> {
    this.logger.log(`Inbound from ${from}: "${body.slice(0, 80)}" SID=${messageSid}`);

    // 1. Idempotency check
    if (await this.idempotency.isDuplicate(messageSid)) {
      this.logger.debug(`Duplicate SID ${messageSid}, skipping`);
      return;
    }

    // 2. Rate limiting
    if (this.isRateLimited(from)) {
      await this.sendReply(from, this.templates.rateLimited(), null);
      return;
    }

    // 3. Load or create conversation
    const conversation = await this.sessionSvc.findOrCreateConversation(from);

    // 4. Store inbound message event
    await this.prisma.whatsAppMessageEvent.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        twilioMessageSid: messageSid,
        body,
        rawPayload: rawPayload as object ?? null,
      },
    });

    // 5. Touch inbound timestamp
    await this.sessionSvc.touchInbound(conversation.id);

    // 6. Check expiry
    if (this.sessionSvc.isExpired(conversation) && conversation.currentStep !== 'IDLE') {
      this.logger.log(`Conversation ${conversation.id} expired, resetting`);
      await this.sessionSvc.setStatus(conversation.id, 'EXPIRED');
      const newConv = await this.sessionSvc.createConversation(from);
      await this.sendReply(from, this.templates.sessionExpired(), newConv.id);
      return;
    }

    // 7. Parse command
    const command = this.parser.parseCommand({
      body,
      buttonText: rawPayload?.ButtonText,
      buttonPayload: rawPayload?.ButtonPayload,
    });
    this.logger.debug(`Parsed command: ${command.type} (step=${conversation.currentStep})`);

    // 8. Handle global commands
    const globalReply = await this.handleGlobalCommand(conversation, command);
    if (globalReply) {
      await this.sendReply(from, globalReply, conversation.id);
      return;
    }

    // 9. Route to flow handler
    let reply: WhatsAppOutboundMessage;
    try {
      reply = await this.flowHandler.handle(conversation, command);
    } catch (error) {
      this.logger.error(`Flow handler error: ${error}`);
      reply = this.templates.errorMessage(
        'Something went wrong. Reply *HELP* for commands.',
      );
    }

    // 10. Send reply
    await this.sendReply(from, reply, conversation.id);
  }

  /**
   * Send a WhatsApp notification for a completed conversion
   * Called by the notification listener
   */
  async sendCompletionNotification(
    conversionSessionId: string,
  ): Promise<void> {
    const conversation = await this.sessionSvc.findBySessionId(conversionSessionId);
    if (!conversation) {
      this.logger.debug(`No WhatsApp conversation for session ${conversionSessionId}`);
      return;
    }

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
      await this.sendReply(conversation.phoneNumber, message, conversation.id);

      this.logger.log(
        `Sent completion notification to ${conversation.phoneNumber} for session ${conversionSessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send completion notification for session ${conversionSessionId}: ${error}`,
      );
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private async handleGlobalCommand(
    conversation: ReturnType<typeof Object>,
    command: ReturnType<WhatsAppParserService['parseCommand']>,
  ): Promise<WhatsAppOutboundMessage | null> {
    const conv = conversation as Awaited<
      ReturnType<WhatsAppSessionService['findOrCreateConversation']>
    >;

    switch (command.type) {
      case 'HELP':
        return this.templates.helpMessage();

      case 'RATES': {
        try {
          const rates = await this.ratesService.getAllRates();
          return this.templates.showRates(rates);
        } catch {
          return this.templates.errorMessage('Could not fetch live rates right now.');
        }
      }

      case 'CANCEL':
        if (conv.currentStep !== 'IDLE' && conv.currentStep !== 'COMPLETED') {
          await this.sessionSvc.resetConversation(conv.id);
          return this.templates.cancelConfirmation();
        }
        return this.templates.welcomeMenu();

      case 'START_OVER':
        await this.sessionSvc.setStatus(conv.id, 'CANCELLED');
        await this.sessionSvc.createConversation(conv.phoneNumber);
        return this.templates.welcomeMenu();

      case 'STATUS':
        if (conv.conversionSessionId) {
          try {
            const status = await this.conversionService.getStatus(
              conv.conversionSessionId,
            );
            return this.templates.conversionStatus(status);
          } catch {
            return this.templates.errorMessage('Could not retrieve status.');
          }
        }
        return null; // Not a global STATUS, pass to flow handler

      case 'GREETING':
        if (conv.currentStep === 'IDLE') {
          return null; // Let flow handler show menu
        }
        return null; // Don't intercept greetings mid-flow

      default:
        return null;
    }
  }

  private async sendReply(
    to: string,
    message: WhatsAppOutboundMessage,
    conversationId: string | null,
  ): Promise<void> {
    try {
      const result = await this.twilio.sendMessage(to, message);

      if (conversationId) {
        await this.prisma.whatsAppMessageEvent.create({
          data: {
            conversationId,
            direction: 'OUTBOUND',
            twilioMessageSid: result.messageSid,
            body: message.body,
            rawPayload: {
              channel: result.channel ?? 'text',
              contentSid: result.contentSid ?? null,
              buttonPayloads:
                message.interactive?.buttons.map((button) => button.id) ?? [],
            },
          },
        });
        await this.sessionSvc.touchOutbound(conversationId);
      }
    } catch (error) {
      this.logger.error(`Failed to send message to ${to}: ${error}`);
    }
  }

  private isRateLimited(phone: string): boolean {
    const now = Date.now();
    const windowMs = 60_000;
    const timestamps = this.rateLimitMap.get(phone) ?? [];

    // Prune old timestamps
    const recent = timestamps.filter((t) => now - t < windowMs);
    recent.push(now);
    this.rateLimitMap.set(phone, recent);

    return recent.length > this.rateLimitPerMinute;
  }
}
