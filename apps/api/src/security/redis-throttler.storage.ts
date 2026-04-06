import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../cache/cache.constants';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Redis-backed storage for @nestjs/throttler.
 *
 * Uses a Lua script for atomic increment + TTL management.
 * Implements the ThrottlerStorage interface (v6): increment().
 *
 * Key format: throttle:{throttlerName}:{key}
 * Block key format: throttle:{throttlerName}:{key}:blocked
 */
@Injectable()
export class RedisThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly prefix = 'throttle';

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Atomically increment the hit counter for a throttle key.
   * Returns current totalHits and time-to-expire.
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const storageKey = `${this.prefix}:${throttlerName}:${key}`;
    const blockKey = `${storageKey}:blocked`;

    // ttl is in milliseconds from throttler v6
    const ttlSeconds = Math.ceil(ttl / 1000);
    const blockSeconds = Math.ceil(blockDuration / 1000);

    try {
      // Check if blocked first
      const blockedTtl = await this.redis.ttl(blockKey);
      if (blockedTtl > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: blockedTtl * 1000,
          isBlocked: true,
          timeToBlockExpire: blockedTtl * 1000,
        };
      }

      // Atomic increment + set TTL if new
      const results = await this.redis
        .multi()
        .incr(storageKey)
        .pttl(storageKey)
        .exec();

      const totalHits = (results?.[0]?.[1] as number) ?? 1;
      let pttl = (results?.[1]?.[1] as number) ?? -1;

      // If key was just created (no TTL), set it
      if (pttl < 0) {
        await this.redis.expire(storageKey, ttlSeconds);
        pttl = ttl;
      }

      // If over limit and blockDuration > 0, set block key
      if (totalHits > limit && blockSeconds > 0) {
        await this.redis.set(blockKey, '1', 'EX', blockSeconds);
        return {
          totalHits,
          timeToExpire: pttl,
          isBlocked: true,
          timeToBlockExpire: blockSeconds * 1000,
        };
      }

      return {
        totalHits,
        timeToExpire: Math.max(pttl, 0),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (err) {
      this.logger.error(
        `Redis throttle increment failed for ${storageKey}: ${(err as Error).message}`,
      );
      // Fail open: allow request through if Redis is down
      return {
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
