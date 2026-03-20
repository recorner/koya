import { Module } from '@nestjs/common';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';
import { RatesWarmerService } from './rates-warmer.service';
import { RatesAggregator } from './aggregation/rates.aggregator';
import { RatesRouteBuilder } from './aggregation/rates.route-builder';
import { RatesValidator } from './aggregation/rates.validator';
import { RatesCache } from './cache/rates.cache';
import { RatesHealth } from './health/rates.health';
import { BinanceProvider } from './providers/binance.provider';
import { KrakenProvider } from './providers/kraken.provider';
import { FxProvider } from './providers/fx.provider';
import type { RatesProvider } from './providers/provider.interface';

/**
 * Rates module — multi-provider rate intelligence.
 *
 * Wires providers, aggregation, caching, and health together.
 * The RatesService receives an array of all provider instances.
 */
@Module({
  controllers: [RatesController],
  providers: [
    // Provider adapters
    BinanceProvider,
    KrakenProvider,
    FxProvider,

    // Aggregation layer
    RatesAggregator,
    RatesRouteBuilder,
    RatesValidator,

    // Cache layer
    RatesCache,

    // Health
    RatesHealth,

    // Cache warmer (runs on startup + every 5s)
    RatesWarmerService,

    // Main service — inject providers as an array
    {
      provide: RatesService,
      useFactory: (
        binance: BinanceProvider,
        kraken: KrakenProvider,
        fx: FxProvider,
        aggregator: RatesAggregator,
        routeBuilder: RatesRouteBuilder,
        validator: RatesValidator,
        ratesCache: RatesCache,
        health: RatesHealth,
      ) => {
        const providers: RatesProvider[] = [binance, kraken, fx];
        return new RatesService(
          providers,
          aggregator,
          routeBuilder,
          validator,
          ratesCache,
          health,
        );
      },
      inject: [
        BinanceProvider,
        KrakenProvider,
        FxProvider,
        RatesAggregator,
        RatesRouteBuilder,
        RatesValidator,
        RatesCache,
        RatesHealth,
      ],
    },
  ],
  exports: [RatesService],
})
export class RatesModule {}
