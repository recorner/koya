import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WhatsAppIdempotencyService {
  private readonly logger = new Logger(WhatsAppIdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if an inbound provider message id has already been processed.
   */
  async isDuplicate(
    providerMessageId: string,
    provider: 'WHATSAPP_CLOUD' | 'TELEGRAM' = 'WHATSAPP_CLOUD',
  ): Promise<boolean> {
    const existing = await this.prisma.whatsAppMessageEvent.findUnique({
      where: { providerMessageId },
      select: { id: true },
    });
    if (existing) {
      this.logger.debug(`Duplicate message id: ${providerMessageId} provider=${provider}`);
    }
    return !!existing;
  }
}
