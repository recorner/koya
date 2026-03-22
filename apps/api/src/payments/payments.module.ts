import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { MpesaService } from './mpesa.service';
import { MPESA_ADAPTER } from '../providers/mpesa-adapter.interface';
import { MockMpesaAdapter } from '../providers/mock-mpesa.adapter';
import { DarajaMpesaAdapter } from '../providers/daraja-mpesa.adapter';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [ConfigModule, WebhooksModule],
  controllers: [PaymentsController],
  providers: [
    MpesaService,
    MockMpesaAdapter,
    DarajaMpesaAdapter,
    {
      provide: MPESA_ADAPTER,
      useFactory: (
        config: ConfigService,
        mock: MockMpesaAdapter,
        daraja: DarajaMpesaAdapter,
      ) => {
        const driver = config.get<string>('MPESA_DRIVER', 'mock');
        return driver === 'daraja' ? daraja : mock;
      },
      inject: [ConfigService, MockMpesaAdapter, DarajaMpesaAdapter],
    },
  ],
  exports: [MpesaService],
})
export class PaymentsModule {}
