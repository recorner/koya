import { RedisThrottlerStorage } from '../redis-throttler.storage';

/**
 * Unit tests for RedisThrottlerStorage.
 * Uses a minimal mock of ioredis to verify:
 * 1. Increment logic with TTL management
 * 2. Block key behavior
 * 3. Fail-open on Redis errors
 */
describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;
  let mockRedis: {
    ttl: jest.Mock;
    multi: jest.Mock;
    incr: jest.Mock;
    pttl: jest.Mock;
    exec: jest.Mock;
    expire: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(() => {
    mockRedis = {
      ttl: jest.fn().mockResolvedValue(-2), // key doesn't exist
      multi: jest.fn().mockReturnThis(),
      incr: jest.fn().mockReturnThis(),
      pttl: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        [null, 1], // INCR result
        [null, -1], // PTTL result (no TTL set yet)
      ]),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
    };

    storage = new RedisThrottlerStorage(mockRedis as never);
  });

  it('should increment and set TTL on first hit', async () => {
    const result = await storage.increment(
      'test-key',
      60000, // 60s in ms
      10,
      0,
      'default',
    );

    expect(result.totalHits).toBe(1);
    expect(result.isBlocked).toBe(false);
    expect(result.timeToBlockExpire).toBe(0);
    expect(mockRedis.expire).toHaveBeenCalledWith(
      'throttle:default:test-key',
      60,
    );
  });

  it('should return existing TTL on subsequent hits', async () => {
    mockRedis.exec.mockResolvedValue([
      [null, 5], // 5th hit
      [null, 45000], // 45s remaining
    ]);

    const result = await storage.increment(
      'test-key',
      60000,
      10,
      0,
      'default',
    );

    expect(result.totalHits).toBe(5);
    expect(result.timeToExpire).toBe(45000);
    expect(result.isBlocked).toBe(false);
    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('should detect blocked state', async () => {
    mockRedis.ttl.mockResolvedValue(30); // Block key has 30s TTL

    const result = await storage.increment(
      'blocked-key',
      60000,
      10,
      60000,
      'default',
    );

    expect(result.isBlocked).toBe(true);
    expect(result.totalHits).toBeGreaterThan(10);
    expect(result.timeToBlockExpire).toBe(30000);
  });

  it('should set block key when limit exceeded and blockDuration > 0', async () => {
    mockRedis.exec.mockResolvedValue([
      [null, 11], // Over limit
      [null, 50000],
    ]);

    const result = await storage.increment(
      'test-key',
      60000,
      10,
      120000, // 2 minute block
      'default',
    );

    expect(result.isBlocked).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'throttle:default:test-key:blocked',
      '1',
      'EX',
      120,
    );
  });

  it('should fail open when Redis errors occur', async () => {
    mockRedis.ttl.mockRejectedValue(new Error('Connection refused'));

    const result = await storage.increment(
      'test-key',
      60000,
      10,
      0,
      'default',
    );

    expect(result.totalHits).toBe(0);
    expect(result.isBlocked).toBe(false);
  });

  it('should use throttler name in key prefix', async () => {
    await storage.increment('my-ip', 60000, 10, 0, 'webhook');

    expect(mockRedis.ttl).toHaveBeenCalledWith(
      'throttle:webhook:my-ip:blocked',
    );
  });
});
