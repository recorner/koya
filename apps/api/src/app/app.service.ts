import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class AppService {
  constructor(private readonly cache: CacheService) {}

  async getHealth() {
    const cacheStatus = await this.cache.ping();
    return {
      status: cacheStatus.ok ? 'ok' : 'degraded',
      service: 'koya-api',
      timestamp: new Date().toISOString(),
      cache: {
        status: cacheStatus.ok ? 'ok' : 'down',
        latencyMs: cacheStatus.latencyMs,
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
}
