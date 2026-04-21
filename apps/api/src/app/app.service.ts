import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { RatesService } from '../rates/rates.service';
import { BriaEventConsumerService } from '../conversion/bria-event-consumer.service';

@Injectable()
export class AppService {
  constructor(
    private readonly cache: CacheService,
    private readonly rates: RatesService,
    private readonly briaEventConsumer: BriaEventConsumerService,
  ) {}

  async getHealth() {
    const briaStatus = this.briaEventConsumer.getConnectivityStatus();

    let status: 'ok' | 'degraded' = 'ok';
    if (briaStatus.enabled && !briaStatus.connected) {
      status = 'degraded';
    }

    return {
      status,
      service: 'koya-api',
      release: process.env.RELEASE_FAMILY || 'unknown',
      version: process.env.RELEASE_VERSION || 'unknown',
      timestamp: new Date().toISOString(),
      cache: {
        status: 'unknown',
        latencyMs: null,
      },
      rates: {
        status: 'unknown',
      },
      bria: briaStatus,
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
