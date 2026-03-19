import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../cache.service';
import { REDIS_CLIENT } from '../cache.constants';
import type { LockResult } from '../cache.types';

/**
 * Create a mock ioredis client with jest spies.
 */
function createMockRedis() {
  return {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    incr: jest.fn(),
    eval: jest.fn(),
    ping: jest.fn(),
    quit: jest.fn(),
  };
}

describe('CacheService', () => {
  let service: CacheService;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(async () => {
    redis = createMockRedis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  // ── Basic Operations ────────────────────────────────────────────

  describe('get', () => {
    it('should return the value for an existing key', async () => {
      redis.get.mockResolvedValue('hello');
      expect(await service.get('test-key')).toBe('hello');
      expect(redis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for a missing key', async () => {
      redis.get.mockResolvedValue(null);
      expect(await service.get('missing')).toBeNull();
    });

    it('should return null on error', async () => {
      redis.get.mockRejectedValue(new Error('connection refused'));
      expect(await service.get('fail')).toBeNull();
    });
  });

  describe('set', () => {
    it('should set a value without TTL', async () => {
      redis.set.mockResolvedValue('OK');
      expect(await service.set('key', 'value')).toBe(true);
      expect(redis.set).toHaveBeenCalledWith('key', 'value');
    });

    it('should set a value with TTL', async () => {
      redis.set.mockResolvedValue('OK');
      expect(await service.set('key', 'value', 30)).toBe(true);
      expect(redis.set).toHaveBeenCalledWith('key', 'value', 'EX', 30);
    });

    it('should return false on error', async () => {
      redis.set.mockRejectedValue(new Error('fail'));
      expect(await service.set('key', 'value')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should return true when key existed', async () => {
      redis.del.mockResolvedValue(1);
      expect(await service.delete('key')).toBe(true);
    });

    it('should return false when key did not exist', async () => {
      redis.del.mockResolvedValue(0);
      expect(await service.delete('missing')).toBe(false);
    });

    it('should return false on error', async () => {
      redis.del.mockRejectedValue(new Error('fail'));
      expect(await service.delete('key')).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      redis.exists.mockResolvedValue(1);
      expect(await service.exists('key')).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      redis.exists.mockResolvedValue(0);
      expect(await service.exists('missing')).toBe(false);
    });

    it('should return false on error', async () => {
      redis.exists.mockRejectedValue(new Error('fail'));
      expect(await service.exists('key')).toBe(false);
    });
  });

  // ── JSON Helpers ────────────────────────────────────────────────

  describe('getJSON', () => {
    it('should parse stored JSON', async () => {
      const obj = { rate: 0.000045, pair: 'KES/BTC' };
      redis.get.mockResolvedValue(JSON.stringify(obj));
      expect(await service.getJSON('rates:spot:KES/BTC')).toEqual(obj);
    });

    it('should return null for missing key', async () => {
      redis.get.mockResolvedValue(null);
      expect(await service.getJSON('missing')).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      redis.get.mockResolvedValue('not-json{{{');
      expect(await service.getJSON('bad')).toBeNull();
    });
  });

  describe('setJSON', () => {
    it('should serialize and store object', async () => {
      redis.set.mockResolvedValue('OK');
      const obj = { status: 'healthy' };
      expect(await service.setJSON('health', obj, 60)).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        'health',
        JSON.stringify(obj),
        'EX',
        60,
      );
    });

    it('should return false on serialization error', async () => {
      const circular: Record<string, unknown> = {};
      circular['self'] = circular;
      expect(await service.setJSON('bad', circular)).toBe(false);
    });
  });

  // ── Atomic Operations ───────────────────────────────────────────

  describe('setIfNotExists', () => {
    it('should return true when key was set', async () => {
      redis.set.mockResolvedValue('OK');
      expect(await service.setIfNotExists('idem:abc', 'done', 30)).toBe(true);
      expect(redis.set).toHaveBeenCalledWith('idem:abc', 'done', 'EX', 30, 'NX');
    });

    it('should return false when key already existed', async () => {
      redis.set.mockResolvedValue(null);
      expect(await service.setIfNotExists('idem:abc', 'done', 30)).toBe(false);
    });

    it('should return false on error', async () => {
      redis.set.mockRejectedValue(new Error('fail'));
      expect(await service.setIfNotExists('key', 'val', 10)).toBe(false);
    });
  });

  describe('increment', () => {
    it('should return incremented value', async () => {
      redis.incr.mockResolvedValue(5);
      expect(await service.increment('counter')).toBe(5);
    });

    it('should return null on error', async () => {
      redis.incr.mockRejectedValue(new Error('fail'));
      expect(await service.increment('counter')).toBeNull();
    });
  });

  // ── Distributed Locks ───────────────────────────────────────────

  describe('acquireLock', () => {
    it('should acquire a lock and return token', async () => {
      redis.set.mockResolvedValue('OK');
      const result: LockResult = await service.acquireLock('lock:quote:abc', 10);
      expect(result.acquired).toBe(true);
      expect(result.token).toBeTruthy();
      expect(redis.set).toHaveBeenCalledWith(
        'lock:quote:abc',
        expect.any(String),
        'EX',
        10,
        'NX',
      );
    });

    it('should fail when lock is already held', async () => {
      redis.set.mockResolvedValue(null);
      const result = await service.acquireLock('lock:quote:abc');
      expect(result.acquired).toBe(false);
      expect(result.token).toBeNull();
    });

    it('should fail gracefully on error', async () => {
      redis.set.mockRejectedValue(new Error('fail'));
      const result = await service.acquireLock('lock:x');
      expect(result.acquired).toBe(false);
      expect(result.token).toBeNull();
    });
  });

  describe('releaseLock', () => {
    it('should release a lock owned by the caller', async () => {
      redis.eval.mockResolvedValue(1);
      expect(await service.releaseLock('lock:abc', 'my-token')).toBe(true);
      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        1,
        'lock:abc',
        'my-token',
      );
    });

    it('should fail if token does not match', async () => {
      redis.eval.mockResolvedValue(0);
      expect(await service.releaseLock('lock:abc', 'wrong-token')).toBe(false);
    });

    it('should fail gracefully on error', async () => {
      redis.eval.mockRejectedValue(new Error('fail'));
      expect(await service.releaseLock('lock:abc', 'token')).toBe(false);
    });
  });

  // ── Health ──────────────────────────────────────────────────────

  describe('ping', () => {
    it('should return ok and latency on success', async () => {
      redis.ping.mockResolvedValue('PONG');
      const result = await service.ping();
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return not ok on failure', async () => {
      redis.ping.mockRejectedValue(new Error('down'));
      const result = await service.ping();
      expect(result.ok).toBe(false);
    });
  });
});

// ── Key Namespace Helpers ───────────────────────────────────────────

describe('cache.constants', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildKey, CacheNamespace, DefaultTTL } = require('../cache.constants');

  describe('buildKey', () => {
    it('should build namespaced keys', () => {
      expect(buildKey(CacheNamespace.QUOTE, 'abc-123')).toBe('quote:abc-123');
      expect(buildKey(CacheNamespace.RATES_SPOT, 'KES/BTC')).toBe(
        'rates:spot:KES/BTC',
      );
      expect(buildKey(CacheNamespace.LOCK, 'tx-456')).toBe('lock:tx-456');
      expect(buildKey(CacheNamespace.SESSION, 'sess-1')).toBe('session:sess-1');
      expect(buildKey(CacheNamespace.IDEMPOTENCY, 'key1')).toBe(
        'idempotency:key1',
      );
      expect(buildKey(CacheNamespace.PROVIDER_HEALTH, 'mpesa')).toBe(
        'provider_health:mpesa',
      );
    });
  });

  describe('DefaultTTL', () => {
    it('should have reasonable TTL values', () => {
      expect(DefaultTTL.CRYPTO_SPOT).toBeLessThanOrEqual(10);
      expect(DefaultTTL.FX_RATE).toBeGreaterThanOrEqual(30);
      expect(DefaultTTL.QUOTE).toBe(30);
      expect(DefaultTTL.LOCK).toBeLessThanOrEqual(15);
      expect(DefaultTTL.PROVIDER_HEALTH).toBe(60);
    });
  });

  describe('CacheNamespace', () => {
    it('should have all required namespaces', () => {
      expect(CacheNamespace.SESSION).toBe('session');
      expect(CacheNamespace.RATES_SPOT).toBe('rates:spot');
      expect(CacheNamespace.RATES_DERIVED).toBe('rates:derived');
      expect(CacheNamespace.RATES_LASTGOOD).toBe('rates:lastgood');
      expect(CacheNamespace.QUOTE).toBe('quote');
      expect(CacheNamespace.QUOTE_LOCK).toBe('quote_lock');
      expect(CacheNamespace.IDEMPOTENCY).toBe('idempotency');
      expect(CacheNamespace.PROVIDER_HEALTH).toBe('provider_health');
      expect(CacheNamespace.LOCK).toBe('lock');
    });
  });
});
