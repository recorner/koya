import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { KoyaThrottlerGuard } from './koya-throttler.guard';
import { CacheModule } from '../cache/cache.module';
import { REDIS_CLIENT } from '../cache/cache.constants';

/**
 * API Security Module
 *
 * Wires Redis-backed rate limiting with environment-driven thresholds.
 * Default policy: 60 req/min/IP (overridden per-route via decorators).
 *
 * Environment variables:
 *  - THROTTLE_DEFAULT_LIMIT (default: 60)
 *  - THROTTLE_DEFAULT_TTL_SECONDS (default: 60)
 */
@Module({
  imports: [
    CacheModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (
        config: ConfigService,
        redis: Redis,
      ) => ({
        throttlers: [
          {
            name: 'default',
            limit: config.get<number>('THROTTLE_DEFAULT_LIMIT', 60),
            ttl: config.get<number>('THROTTLE_DEFAULT_TTL_SECONDS', 60) * 1000,
          },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
  ],
  providers: [
    {
      provide: RedisThrottlerStorage,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => new RedisThrottlerStorage(redis),
    },
    {
      provide: APP_GUARD,
      useClass: KoyaThrottlerGuard,
    },
  ],
  exports: [RedisThrottlerStorage],
})
export class ApiSecurityModule {}
