import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { CacheService } from '../cache.service';
import { REDIS_CLIENT } from '../cache.constants';

/**
 * Integration tests — require a running Redis instance.
 *
 * Run with: docker-compose up redis -d && pnpm nx test api --testPathPattern="cache.integration"
 * Skip in CI unless Redis is available.
 */
describe('CacheService (Integration)', () => {
  let service: CacheService;
  let redis: Redis;
  let module: TestingModule;

  const testPrefix = `test:${Date.now()}`;

  beforeAll(async () => {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB || '1', 10), // use DB 1 for tests
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    try {
      await redis.connect();
    } catch {
      // Redis not available — skip all tests
      redis = null as unknown as Redis;
      return;
    }

    module = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterAll(async () => {
    if (redis) {
      // Clean up test keys
      const keys = await redis.keys(`${testPrefix}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.quit();
    }
  });

  function key(name: string) {
    return `${testPrefix}:${name}`;
  }

  // ── Connectivity ────────────────────────────────────────────────

  describe('connectivity', () => {
    it('should ping Redis', async () => {
      if (!redis) return;
      const result = await service.ping();
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeLessThan(500);
    });
  });

  // ── Basic Operations ────────────────────────────────────────────

  describe('set/get', () => {
    it('should set and retrieve a value', async () => {
      if (!redis) return;
      const k = key('basic');
      await service.set(k, 'hello');
      expect(await service.get(k)).toBe('hello');
    });

    it('should return null for missing key', async () => {
      if (!redis) return;
      expect(await service.get(key('nonexistent'))).toBeNull();
    });

    it('should delete a key', async () => {
      if (!redis) return;
      const k = key('delete-me');
      await service.set(k, 'temp');
      expect(await service.delete(k)).toBe(true);
      expect(await service.get(k)).toBeNull();
    });

    it('should check existence', async () => {
      if (!redis) return;
      const k = key('exists-check');
      await service.set(k, '1');
      expect(await service.exists(k)).toBe(true);
      expect(await service.exists(key('no-exist'))).toBe(false);
    });
  });

  // ── TTL Expiry ──────────────────────────────────────────────────

  describe('TTL expiry', () => {
    it('should expire a key after TTL', async () => {
      if (!redis) return;
      const k = key('ttl-test');
      await service.set(k, 'expiring', 1); // 1 second TTL
      expect(await service.get(k)).toBe('expiring');

      await new Promise((r) => setTimeout(r, 1200));
      expect(await service.get(k)).toBeNull();
    }, 5000);
  });

  // ── JSON Helpers ────────────────────────────────────────────────

  describe('JSON operations', () => {
    it('should set and get JSON', async () => {
      if (!redis) return;
      const k = key('json');
      const data = { rate: 0.000045, pair: 'KES/BTC', ts: Date.now() };
      await service.setJSON(k, data, 30);
      const result = await service.getJSON<typeof data>(k);
      expect(result).toEqual(data);
    });
  });

  // ── Atomic Operations ───────────────────────────────────────────

  describe('atomic operations', () => {
    it('setIfNotExists should succeed on first call', async () => {
      if (!redis) return;
      const k = key('setnx');
      expect(await service.setIfNotExists(k, 'first', 10)).toBe(true);
      expect(await service.setIfNotExists(k, 'second', 10)).toBe(false);
      expect(await service.get(k)).toBe('first');
    });

    it('increment should work', async () => {
      if (!redis) return;
      const k = key('counter');
      expect(await service.increment(k)).toBe(1);
      expect(await service.increment(k)).toBe(2);
      expect(await service.increment(k)).toBe(3);
    });
  });

  // ── Distributed Locks ───────────────────────────────────────────

  describe('distributed locks', () => {
    it('should acquire and release a lock', async () => {
      if (!redis) return;
      const resource = key('lock:test');
      const result = await service.acquireLock(resource, 10);
      expect(result.acquired).toBe(true);
      expect(result.token).toBeTruthy();

      // Release with correct token
      expect(await service.releaseLock(resource, result.token!)).toBe(true);
    });

    it('should reject concurrent lock acquisition', async () => {
      if (!redis) return;
      const resource = key('lock:concurrent');
      const first = await service.acquireLock(resource, 10);
      expect(first.acquired).toBe(true);

      const second = await service.acquireLock(resource, 10);
      expect(second.acquired).toBe(false);

      // Clean up
      await service.releaseLock(resource, first.token!);
    });

    it('should not release lock with wrong token', async () => {
      if (!redis) return;
      const resource = key('lock:wrong-token');
      const result = await service.acquireLock(resource, 10);
      expect(result.acquired).toBe(true);

      expect(await service.releaseLock(resource, 'wrong-token')).toBe(false);

      // Clean up with correct token
      await service.releaseLock(resource, result.token!);
    });

    it('should auto-expire locks after TTL', async () => {
      if (!redis) return;
      const resource = key('lock:expire');
      const result = await service.acquireLock(resource, 1); // 1 second
      expect(result.acquired).toBe(true);

      await new Promise((r) => setTimeout(r, 1200));

      // Lock should have expired, new acquisition should succeed
      const second = await service.acquireLock(resource, 10);
      expect(second.acquired).toBe(true);
      await service.releaseLock(resource, second.token!);
    }, 5000);
  });
});
