import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProcessedWebhookService {
  private readonly logger = new Logger(ProcessedWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Attempt to mark a webhook as processed. Uses INSERT ... ON CONFLICT DO NOTHING
   * for atomic deduplication.
   *
   * @returns true if newly processed, false if already processed (duplicate)
   */
  async markProcessed(source: string, externalId: string): Promise<boolean> {
    const result = await this.prisma.$executeRaw`
      INSERT INTO processed_webhooks (id, source, external_id, processed_at)
      VALUES (gen_random_uuid(), ${source}, ${externalId}, NOW())
      ON CONFLICT (source, external_id) DO NOTHING
    `;
    if (result === 0) {
      this.logger.log(
        `Duplicate webhook ignored: source=${source} externalId=${externalId}`,
      );
      return false;
    }
    return true;
  }
}
