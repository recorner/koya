import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WhatsAppIdempotencyService {
  private readonly logger = new Logger(WhatsAppIdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a Twilio message SID has already been processed
   */
  async isDuplicate(twilioMessageSid: string): Promise<boolean> {
    const existing = await this.prisma.whatsAppMessageEvent.findUnique({
      where: { twilioMessageSid },
      select: { id: true },
    });
    if (existing) {
      this.logger.debug(`Duplicate message SID: ${twilioMessageSid}`);
    }
    return !!existing;
  }
}
