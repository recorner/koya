import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DfnsService } from './dfns.service';
import { DfnsController } from './dfns.controller';
import { DfnsHealthController } from './dfns-health.controller';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [ConfigModule, WebhooksModule],
  controllers: [DfnsController, DfnsHealthController],
  providers: [DfnsService],
  exports: [DfnsService],
})
export class DfnsModule {}
