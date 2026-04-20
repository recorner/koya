import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingOrchestratorService } from './messaging-orchestrator.service';
import { MessagingProviderRouter } from './messaging-provider.router';
import {
  MESSAGING_PROVIDERS,
  type MessagingProvider,
} from './providers/messaging-provider.interface';
import { WhatsAppCloudProvider } from './providers/whatsapp-cloud.provider';
import { TelegramProvider } from './providers/telegram.provider';
import { MessagingPersistenceService } from './messaging-persistence.service';
import { ChatConversionFlowService } from './chat-conversion-flow.service';
import { ConversionNotificationListener } from './conversion-notification.listener';
import { MessagingConfigValidator } from './messaging-config.validator';
import { ConversionModule } from '../conversion/conversion.module';
import { RatesModule } from '../rates/rates.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [ConversionModule, RatesModule, WhatsAppModule],
  controllers: [MessagingController],
  providers: [
    WhatsAppCloudProvider,
    TelegramProvider,
    MessagingProviderRouter,
    MessagingPersistenceService,
    ChatConversionFlowService,
    MessagingOrchestratorService,
    ConversionNotificationListener,
    MessagingConfigValidator,
    {
      provide: MESSAGING_PROVIDERS,
      useFactory: (
        whatsappCloudProvider: WhatsAppCloudProvider,
        telegramProvider: TelegramProvider,
      ): MessagingProvider[] => [whatsappCloudProvider, telegramProvider],
      inject: [WhatsAppCloudProvider, TelegramProvider],
    },
  ],
  exports: [MessagingOrchestratorService, ChatConversionFlowService],
})
export class MessagingModule {}
