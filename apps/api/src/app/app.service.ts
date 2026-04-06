import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { RatesService } from '../rates/rates.service';

@Injectable()
export class AppService {
  constructor(
    private readonly cache: CacheService,
    private readonly rates: RatesService,
  ) {}

  async getHealth() {
    const cacheStatus = await this.cache.ping();
    const ratesHealth = await this.rates.getHealthReport();
    return {
      status: cacheStatus.ok ? 'ok' : 'degraded',
      service: 'koya-api',
      release: process.env.RELEASE_FAMILY || 'unknown',
      version: process.env.RELEASE_VERSION || 'unknown',
      timestamp: new Date().toISOString(),
      cache: {
        status: cacheStatus.ok ? 'ok' : 'down',
        latencyMs: cacheStatus.latencyMs,
      },
      rates: {
        status: ratesHealth.status,
      },
    };
  }

  async getCacheHealth() {
    const result = await this.cache.ping();
    return {
      status: result.ok ? 'ok' : 'down',
      latencyMs: result.latencyMs,
      timestamp: new Date().toISOString(),
    };
  }

  async getRatesHealth() {
    return this.rates.getHealthReport();
  }
}
