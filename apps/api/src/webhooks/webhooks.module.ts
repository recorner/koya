import { Module } from '@nestjs/common';
import { ProcessedWebhookService } from './processed-webhook.service';

@Module({
  providers: [ProcessedWebhookService],
  exports: [ProcessedWebhookService],
})
export class WebhooksModule {}
