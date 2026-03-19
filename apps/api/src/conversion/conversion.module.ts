import { Module } from '@nestjs/common';
import { ConversionController } from './conversion.controller';
import { ConversionService } from './conversion.service';
import { QuoteService } from './quote.service';
import { SessionService } from './session.service';
import { KycModule } from '../kyc/kyc.module';
import { PaymentsModule } from '../payments/payments.module';
import { RiskModule } from '../risk/risk.module';
import { RatesModule } from '../rates/rates.module';
import { RATE_PROVIDER } from '../providers/rate-provider.interface';
import { LiveRateProvider } from '../providers/live-rate.provider';
import { BTC_DELIVERY_PROVIDER } from '../providers/btc-delivery.interface';
import { MockBtcDeliveryProvider } from '../providers/mock-btc-delivery.provider';
import { SWAP_PROVIDER } from '../providers/swap-provider.interface';
import { MockSwapProvider } from '../providers/mock-swap.provider';

@Module({
  imports: [KycModule, PaymentsModule, RiskModule, RatesModule],
  controllers: [ConversionController],
  providers: [
    ConversionService,
    QuoteService,
    SessionService,
    { provide: RATE_PROVIDER, useClass: LiveRateProvider },
    { provide: BTC_DELIVERY_PROVIDER, useClass: MockBtcDeliveryProvider },
    { provide: SWAP_PROVIDER, useClass: MockSwapProvider },
  ],
  exports: [ConversionService],
})
export class ConversionModule {}
