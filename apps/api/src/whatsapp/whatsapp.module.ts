import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppSessionService } from './whatsapp-session.service';
import { WhatsAppParserService } from './whatsapp-parser.service';
import { WhatsAppTemplateService } from './whatsapp-template.service';
import { WhatsAppIdempotencyService } from './whatsapp-idempotency.service';
import { WhatsAppFlowHandler } from './whatsapp-flow.handler';
import { WhatsAppNotificationListener } from './whatsapp-notification.listener';
import { WhatsAppCmsCopyService } from './whatsapp-cms-copy.service';
import { ConversionModule } from '../conversion/conversion.module';
import { TWILIO_ADAPTER } from '../providers/twilio-adapter.interface';
import { MockTwilioAdapter } from '../providers/mock-twilio.adapter';
import { RealTwilioAdapter } from '../providers/twilio.adapter';

@Module({
  imports: [ConversionModule],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppSessionService,
    WhatsAppParserService,
    WhatsAppCmsCopyService,
    WhatsAppTemplateService,
    WhatsAppIdempotencyService,
    WhatsAppFlowHandler,
    WhatsAppNotificationListener,
    {
      provide: TWILIO_ADAPTER,
      useFactory: (config: ConfigService) => {
        const sid = config.get<string>('TWILIO_ACCOUNT_SID', '');
        if (sid && !sid.startsWith('mock')) {
          return new RealTwilioAdapter(config);
        }
        return new MockTwilioAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
