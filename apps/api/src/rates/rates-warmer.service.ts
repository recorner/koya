import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RatesService } from './rates.service';

/**
 * Proactively warms the rates cache so that consumers almost always
 * get a cache hit.  Runs on startup and then every 5 seconds.
 *
 * Crypto spot TTL is 5 s and FX is 60 s, so a 5 s interval ensures
 * direct crypto pairs are always warm.  Derived pairs piggy-back on
 * the direct pair cache and are re-derived as needed.
 */
@Injectable()
export class RatesWarmerService implements OnModuleInit {
  private readonly logger = new Logger(RatesWarmerService.name);

  constructor(private readonly ratesService: RatesService) {}

  async onModuleInit() {
    this.logger.log('Warming rates cache on startup…');
    // Do not block API startup on cache backend availability.
    void this.warm();
  }

  @Interval(5_000)
  async warm(): Promise<void> {
    try {
      const rates = await this.ratesService.getAllRates();
      this.logger.debug(`Cache warmed: ${rates.length} pairs`);
    } catch (err) {
      this.logger.error(`Cache warming failed: ${err}`);
    }
  }
}
