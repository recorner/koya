import { Module } from '@nestjs/common';
import { WhatsAppSessionService } from './whatsapp-session.service';
import { WhatsAppParserService } from './whatsapp-parser.service';
import { WhatsAppTemplateService } from './whatsapp-template.service';
import { WhatsAppIdempotencyService } from './whatsapp-idempotency.service';
import { WhatsAppFlowHandler } from './whatsapp-flow.handler';
import { WhatsAppCmsCopyService } from './whatsapp-cms-copy.service';
import { ConversionModule } from '../conversion/conversion.module';
import { RatesModule } from '../rates/rates.module';

@Module({
  imports: [ConversionModule, RatesModule],
  controllers: [],
  providers: [
    WhatsAppSessionService,
    WhatsAppParserService,
    WhatsAppCmsCopyService,
    WhatsAppTemplateService,
    WhatsAppIdempotencyService,
    WhatsAppFlowHandler,
  ],
  exports: [
    WhatsAppSessionService,
    WhatsAppParserService,
    WhatsAppCmsCopyService,
    WhatsAppTemplateService,
    WhatsAppIdempotencyService,
    WhatsAppFlowHandler,
  ],
})
export class WhatsAppModule {}
