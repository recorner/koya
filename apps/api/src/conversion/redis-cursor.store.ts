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
  private readonly timeoutMs = 1000;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getCursor(name: string): Promise<number | null> {
    const key = `${CURSOR_PREFIX}${name}`;
    const val = await Promise.race([
      this.redis.get(key).catch((err: Error) => {
        this.logger.warn(`Cursor read failed for ${name}: ${err.message}`);
        return null;
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => {
          this.logger.warn(`Cursor read timed out for ${name} after ${this.timeoutMs}ms`);
          resolve(null);
        }, this.timeoutMs);
      }),
    ]);

    if (val === null) return null;
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  async setCursor(name: string, seq: number): Promise<void> {
    const key = `${CURSOR_PREFIX}${name}`;
    await Promise.race([
      this.redis.set(key, String(seq)).catch((err: Error) => {
        this.logger.warn(`Cursor write failed for ${name}: ${err.message}`);
        return null;
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => {
          this.logger.warn(`Cursor write timed out for ${name} after ${this.timeoutMs}ms`);
          resolve(null);
        }, this.timeoutMs);
      }),
    ]);
    this.logger.debug(`Cursor ${name} set to ${seq}`);
  }
}
