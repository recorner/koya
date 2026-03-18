import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type {
  WhatsAppConversation,
  WhatsAppFlowStep,
  WhatsAppConversationStatus,
} from '@prisma/client';

@Injectable()
export class WhatsAppSessionService {
  private readonly logger = new Logger(WhatsAppSessionService.name);
  private readonly sessionTtlMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.sessionTtlMinutes = parseInt(
      this.config.get('WHATSAPP_SESSION_TTL_MINUTES', '10'),
      10,
    );
  }

  /**
   * Find an active conversation for a phone number, or create a new one
   */
  async findOrCreateConversation(
    phoneNumber: string,
  ): Promise<WhatsAppConversation> {
    const existing = await this.prisma.whatsAppConversation.findFirst({
      where: { phoneNumber, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    return this.createConversation(phoneNumber);
  }

  /**
   * Create a fresh conversation
   */
  async createConversation(phoneNumber: string): Promise<WhatsAppConversation> {
    const now = new Date();
    return this.prisma.whatsAppConversation.create({
      data: {
        phoneNumber,
        status: 'ACTIVE',
        currentStep: 'IDLE',
        lastInboundAt: now,
        expiresAt: this.computeExpiry(now),
      },
    });
  }

  /**
   * Update the current flow step
   */
  async updateStep(
    conversationId: string,
    step: WhatsAppFlowStep,
  ): Promise<WhatsAppConversation> {
    return this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        currentStep: step,
        expiresAt: this.computeExpiry(new Date()),
      },
    });
  }

  /**
   * Link a conversion session to the conversation
   */
  async linkSession(
    conversationId: string,
    conversionSessionId: string,
  ): Promise<void> {
    await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { conversionSessionId },
    });
  }

  /**
   * Store a pending quote ID in the conversation
   */
  async linkQuote(conversationId: string, quoteId: string): Promise<void> {
    await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { quoteId },
    });
  }

  /**
   * Update metadata JSON (for collecting identity fields one-by-one)
   */
  async updateMetadata(
    conversationId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { metadata: metadata as object },
    });
  }

  /**
   * Reset a conversation back to IDLE state
   */
  async resetConversation(conversationId: string): Promise<WhatsAppConversation> {
    return this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        currentStep: 'IDLE',
        conversionSessionId: null,
        quoteId: null,
        metadata: undefined,
        expiresAt: this.computeExpiry(new Date()),
      },
    });
  }

  /**
   * Mark a conversation as expired/cancelled/completed
   */
  async setStatus(
    conversationId: string,
    status: WhatsAppConversationStatus,
  ): Promise<void> {
    await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { status },
    });
  }

  /**
   * Touch lastInboundAt and extend expiry
   */
  async touchInbound(conversationId: string): Promise<void> {
    const now = new Date();
    await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        lastInboundAt: now,
        expiresAt: this.computeExpiry(now),
      },
    });
  }

  /**
   * Touch lastOutboundAt
   */
  async touchOutbound(conversationId: string): Promise<void> {
    await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { lastOutboundAt: new Date() },
    });
  }

  /**
   * Find conversation by linked conversion session ID
   */
  async findBySessionId(
    conversionSessionId: string,
  ): Promise<WhatsAppConversation | null> {
    return this.prisma.whatsAppConversation.findFirst({
      where: { conversionSessionId, status: 'ACTIVE' },
    });
  }

  /**
   * Check if the conversation has expired
   */
  isExpired(conversation: WhatsAppConversation): boolean {
    return conversation.expiresAt < new Date();
  }

  private computeExpiry(from: Date): Date {
    return new Date(from.getTime() + this.sessionTtlMinutes * 60 * 1000);
  }
}
