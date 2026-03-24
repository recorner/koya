import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../cache/cache.constants';

const CURSOR_PREFIX = 'koya:cursor:';

/**
 * Persists stream consumer cursors in Redis so that Bria event
 * subscription can resume from the last-processed sequence on restart.
 */
@Injectable()
export class RedisCursorStore {
  private readonly logger = new Logger(RedisCursorStore.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getCursor(name: string): Promise<number | null> {
    const val = await this.redis.get(`${CURSOR_PREFIX}${name}`);
    if (val === null) return null;
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  async setCursor(name: string, seq: number): Promise<void> {
    await this.redis.set(`${CURSOR_PREFIX}${name}`, String(seq));
    this.logger.debug(`Cursor ${name} set to ${seq}`);
  }
}
