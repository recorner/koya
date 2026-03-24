import { CircuitBreaker } from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    zadd: jest.Mock;
    zremrangebyscore: jest.Mock;
    zcard: jest.Mock;
    expire: jest.Mock;
  };

  beforeEach(() => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      zadd: jest.fn(),
      zremrangebyscore: jest.fn(),
      zcard: jest.fn(),
      expire: jest.fn(),
    };
  });

  describe('getState', () => {
    it('should return closed when no open_until key exists', async () => {
      redis.get.mockResolvedValue(null);
      const cb = new CircuitBreaker(redis as never, { name: 'test' });
      expect(await cb.getState()).toBe('closed');
    });

    it('should return open when open_until is in the future', async () => {
      redis.get.mockResolvedValue(String(Date.now() + 60_000));
      const cb = new CircuitBreaker(redis as never, { name: 'test' });
      expect(await cb.getState()).toBe('open');
    });

    it('should return half-open when open_until has passed', async () => {
      redis.get.mockResolvedValue(String(Date.now() - 1000));
      const cb = new CircuitBreaker(redis as never, { name: 'test' });
      expect(await cb.getState()).toBe('half-open');
    });
  });

  describe('canExecute', () => {
    it('should allow execution when circuit is closed', async () => {
      redis.get.mockResolvedValue(null);
      const cb = new CircuitBreaker(redis as never, { name: 'test' });
      expect(await cb.canExecute()).toBe(true);
    });

    it('should reject execution when circuit is open', async () => {
      redis.get.mockResolvedValue(String(Date.now() + 60_000));
      const cb = new CircuitBreaker(redis as never, { name: 'test' });
      expect(await cb.canExecute()).toBe(false);
    });

    it('should allow execution when circuit is half-open (probe request)', async () => {
      redis.get.mockResolvedValue(String(Date.now() - 1000));
      const cb = new CircuitBreaker(redis as never, { name: 'test' });
      expect(await cb.canExecute()).toBe(true);
    });
  });

  describe('recordFailure', () => {
    it('should open circuit when failures exceed threshold', async () => {
      redis.get.mockResolvedValue(null);
      redis.zadd.mockResolvedValue(1);
      redis.zremrangebyscore.mockResolvedValue(0);
      redis.expire.mockResolvedValue(1);
      redis.zcard.mockResolvedValue(5); // equals threshold
      redis.set.mockResolvedValue('OK');

      const cb = new CircuitBreaker(redis as never, {
        name: 'test',
        failureThreshold: 5,
        openDurationSecs: 900,
      });

      await cb.recordFailure();

      expect(redis.set).toHaveBeenCalledWith(
        'koya:cb:test:open_until',
        expect.any(String),
        'EX',
        900,
      );
    });

    it('should not open circuit when failures are below threshold', async () => {
      redis.zadd.mockResolvedValue(1);
      redis.zremrangebyscore.mockResolvedValue(0);
      redis.expire.mockResolvedValue(1);
      redis.zcard.mockResolvedValue(3);

      const cb = new CircuitBreaker(redis as never, {
        name: 'test',
        failureThreshold: 5,
      });

      await cb.recordFailure();

      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('recordSuccess', () => {
    it('should close circuit when in half-open state', async () => {
      redis.get.mockResolvedValue(String(Date.now() - 1000)); // expired = half-open
      redis.del.mockResolvedValue(1);

      const cb = new CircuitBreaker(redis as never, { name: 'test' });
      await cb.recordSuccess();

      expect(redis.del).toHaveBeenCalledWith('koya:cb:test:open_until');
      expect(redis.del).toHaveBeenCalledWith('koya:cb:test:failures');
    });

    it('should do nothing when circuit is already closed', async () => {
      redis.get.mockResolvedValue(null); // closed
      const cb = new CircuitBreaker(redis as never, { name: 'test' });
      await cb.recordSuccess();

      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('without Redis', () => {
    it('should always return closed state', async () => {
      const cb = new CircuitBreaker(null, { name: 'test' });
      expect(await cb.getState()).toBe('closed');
      expect(await cb.canExecute()).toBe(true);
    });
  });
});
