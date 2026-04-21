import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../cache/cache.constants';
import { promises as fs } from 'fs';
import path from 'path';

const CURSOR_PREFIX = 'koya:cursor:';

/**
 * Persists stream consumer cursors in Redis so that Bria event
 * subscription can resume from the last-processed sequence on restart.
 * Falls back to a local file to survive transient Redis outages.
 */
@Injectable()
export class RedisCursorStore {
  private readonly logger = new Logger(RedisCursorStore.name);
  private readonly timeoutMs = 1000;
  private readonly fallbackPath = process.env.BRIA_CURSOR_FALLBACK_PATH ?? '/tmp/koya-bria-cursor.json';

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

    if (val !== null) {
      const parsed = parseInt(val, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }

    const fallback = await this.readFallback(name);
    if (fallback !== null) {
      this.logger.warn(`Using fallback cursor for ${name}: ${fallback}`);
    }
    return fallback;
  }

  async setCursor(name: string, seq: number): Promise<void> {
    const key = `${CURSOR_PREFIX}${name}`;
    let redisPersisted = false;

    await Promise.race([
      this.redis.set(key, String(seq)).then(() => {
        redisPersisted = true;
      }).catch((err: Error) => {
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

    await this.writeFallback(name, seq);

    if (redisPersisted) {
      this.logger.debug(`Cursor ${name} set to ${seq}`);
    } else {
      this.logger.warn(`Cursor ${name} persisted via fallback only (seq=${seq})`);
    }
  }

  private async readFallback(name: string): Promise<number | null> {
    try {
      const data = await fs.readFile(this.fallbackPath, 'utf8');
      const parsed = JSON.parse(data) as Record<string, number>;
      const val = parsed[name];
      if (typeof val === 'number' && Number.isFinite(val)) {
        return val;
      }
    } catch {
      // ignore missing/unreadable fallback file
    }

    return null;
  }

  private async writeFallback(name: string, seq: number): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.fallbackPath), { recursive: true });

      let current: Record<string, number> = {};
      try {
        const data = await fs.readFile(this.fallbackPath, 'utf8');
        current = JSON.parse(data) as Record<string, number>;
      } catch {
        current = {};
      }

      current[name] = seq;
      await fs.writeFile(this.fallbackPath, JSON.stringify(current), { mode: 0o600 });
    } catch (error) {
      this.logger.warn(
        `Failed to write cursor fallback file ${this.fallbackPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
