import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { REDIS_CLIENT } from './cache.constants';
import type { LockResult } from './cache.types';

/**
 * Lua script for safe lock release — only deletes if the stored value
 * matches the caller's token (prevents releasing someone else's lock).
 */
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // ── Basic Operations ──────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (err) {
      this.logger.error(`GET failed for key=${key}: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, value);
      }
      return true;
    } catch (err) {
      this.logger.error(`SET failed for key=${key}: ${(err as Error).message}`);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (err) {
      this.logger.error(`DEL failed for key=${key}: ${(err as Error).message}`);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (err) {
      this.logger.error(`EXISTS failed for key=${key}: ${(err as Error).message}`);
      return false;
    }
  }

  // ── JSON Helpers ──────────────────────────────────────────────────

  async getJSON<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.error(`JSON parse failed for key=${key}`);
      return null;
    }
  }

  async setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      return this.set(key, serialized, ttlSeconds);
    } catch (err) {
      this.logger.error(`setJSON failed for key=${key}: ${(err as Error).message}`);
      return false;
    }
  }

  // ── Atomic Operations ─────────────────────────────────────────────

  async setIfNotExists(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      this.logger.error(`SETNX failed for key=${key}: ${(err as Error).message}`);
      return false;
    }
  }

  async increment(key: string): Promise<number | null> {
    try {
      return await this.redis.incr(key);
    } catch (err) {
      this.logger.error(`INCR failed for key=${key}: ${(err as Error).message}`);
      return null;
    }
  }

  // ── Distributed Locks ─────────────────────────────────────────────

  /**
   * Acquire a distributed lock using SET NX EX pattern.
   * Returns a token used to safely release the lock.
   */
  async acquireLock(resource: string, ttlSeconds = 10): Promise<LockResult> {
    const token = randomUUID();
    try {
      const result = await this.redis.set(
        resource,
        token,
        'EX',
        ttlSeconds,
        'NX',
      );
      if (result === 'OK') {
        return { acquired: true, token };
      }
      return { acquired: false, token: null };
    } catch (err) {
      this.logger.error(
        `acquireLock failed for resource=${resource}: ${(err as Error).message}`,
      );
      return { acquired: false, token: null };
    }
  }

  /**
   * Release a distributed lock. Only succeeds if the caller owns
   * the lock (token matches), preventing accidental release.
   */
  async releaseLock(resource: string, token: string): Promise<boolean> {
    try {
      const result = await this.redis.eval(
        RELEASE_LOCK_SCRIPT,
        1,
        resource,
        token,
      );
      return result === 1;
    } catch (err) {
      this.logger.error(
        `releaseLock failed for resource=${resource}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  // ── Health ────────────────────────────────────────────────────────

  /**
   * Ping Redis and measure latency.
   * Used by the health check endpoint.
   */
  async ping(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const result = await Promise.race([
        this.redis.ping().catch(() => 'ERR'),
        new Promise<'TIMEOUT'>((resolve) => {
          setTimeout(() => resolve('TIMEOUT'), 1000);
        }),
      ]);
      return { ok: result === 'PONG', latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}
