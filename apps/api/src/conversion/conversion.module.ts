import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConversionController } from './conversion.controller';
import { ConversionService } from './conversion.service';
import { QuoteService } from './quote.service';
import { SessionService } from './session.service';
import { BriaEventConsumerService } from './bria-event-consumer.service';
import { PsbtSigningService } from './psbt-signing.service';
import { RedisCursorStore } from './redis-cursor.store';
import { BriaSetupService } from './bria-setup.service';
import { BriaSetupController } from './bria-setup.controller';
import { KycModule } from '../kyc/kyc.module';
import { PaymentsModule } from '../payments/payments.module';
import { RiskModule } from '../risk/risk.module';
import { RatesModule } from '../rates/rates.module';
import { BriaModule } from '@koya/bria-adapter';
import { RATE_PROVIDER } from '../providers/rate-provider.interface';
import { LiveRateProvider } from '../providers/live-rate.provider';
import { BTC_DELIVERY_PROVIDER } from '../providers/btc-delivery.interface';
import { MockBtcDeliveryProvider } from '../providers/mock-btc-delivery.provider';
import { BriaBtcDeliveryProvider } from '../providers/bria-btc-delivery.provider';
import { DfnsBtcDeliveryProvider } from '../providers/dfns-btc-delivery.provider';
import { SWAP_PROVIDER } from '../providers/swap-provider.interface';
import { MockSwapProvider } from '../providers/mock-swap.provider';
import { DfnsModule } from '../dfns/dfns.module';
import type { Type } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const controllers: Type<any>[] = [ConversionController];
if (process.env['NODE_ENV'] !== 'production') {
  controllers.push(BriaSetupController);
}

@Module({
  imports: [KycModule, PaymentsModule, RiskModule, RatesModule, BriaModule, DfnsModule, ConfigModule],
  controllers,
  providers: [
    ConversionService,
    QuoteService,
    SessionService,
    BriaEventConsumerService,
    PsbtSigningService,
    RedisCursorStore,
    BriaSetupService,
    MockBtcDeliveryProvider,
    BriaBtcDeliveryProvider,
    DfnsBtcDeliveryProvider,
    { provide: RATE_PROVIDER, useClass: LiveRateProvider },
    {
      provide: BTC_DELIVERY_PROVIDER,
      useFactory: (
        config: ConfigService,
        mock: MockBtcDeliveryProvider,
        bria: BriaBtcDeliveryProvider,
        dfns: DfnsBtcDeliveryProvider,
      ) => {
        const driver = config.get<string>('BTC_DELIVERY_DRIVER', 'mock');
        if (driver === 'bria') return bria;
        if (driver === 'dfns') return dfns;
        return mock;
      },
      inject: [ConfigService, MockBtcDeliveryProvider, BriaBtcDeliveryProvider, DfnsBtcDeliveryProvider],
    },
    { provide: SWAP_PROVIDER, useClass: MockSwapProvider },
  ],
  exports: [ConversionService],
})
export class ConversionModule {}
