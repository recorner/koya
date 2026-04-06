import { ExecutionContext } from '@nestjs/common';
import { KoyaThrottlerGuard } from '../koya-throttler.guard';

/**
 * Unit tests for KoyaThrottlerGuard.
 * Verifies:
 * 1. IP extraction from X-Forwarded-For
 * 2. Health/internal route skipping
 */
describe('KoyaThrottlerGuard', () => {
  let guard: KoyaThrottlerGuard;

  beforeEach(() => {
    // Create guard with minimal mocked dependencies
    guard = new KoyaThrottlerGuard(
      [] as never,    // options
      {} as never,    // storage
      { get: jest.fn() } as never, // reflector
    );
  });

  describe('getTracker', () => {
    it('should extract client IP from X-Forwarded-For header', async () => {
      const req = {
        headers: {
          'x-forwarded-for': '203.0.113.50, 10.0.0.1, 10.0.0.2',
        },
        ip: '10.0.0.2',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('203.0.113.50');
    });

    it('should fallback to req.ip when no X-Forwarded-For', async () => {
      const req = {
        headers: {},
        ip: '127.0.0.1',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('127.0.0.1');
    });

    it('should return "unknown" when no IP available', async () => {
      const req = { headers: {} };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('unknown');
    });

    it('should handle single IP in X-Forwarded-For', async () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '10.0.0.1',
      };

      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('192.168.1.1');
    });
  });

  describe('shouldSkip', () => {
    function createMockContext(url: string): ExecutionContext {
      return {
        switchToHttp: () => ({
          getRequest: () => ({ url }),
        }),
      } as unknown as ExecutionContext;
    }

    it('should skip health endpoints', async () => {
      const context = createMockContext('/api/v1/health');
      const result = await (guard as any).shouldSkip(context);
      expect(result).toBe(true);
    });

    it('should skip health/cache endpoints', async () => {
      const context = createMockContext('/api/v1/health/cache');
      const result = await (guard as any).shouldSkip(context);
      expect(result).toBe(true);
    });

    it('should skip internal routes', async () => {
      const context = createMockContext('/internal/health/dfns');
      const result = await (guard as any).shouldSkip(context);
      expect(result).toBe(true);
    });

    it('should NOT skip conversion routes', async () => {
      const context = createMockContext('/api/v1/guest-conversion/quote');
      const result = await (guard as any).shouldSkip(context);
      expect(result).toBe(false);
    });

    it('should NOT skip payment callback', async () => {
      const context = createMockContext('/api/v1/payments/mpesa/callback');
      const result = await (guard as any).shouldSkip(context);
      expect(result).toBe(false);
    });
  });
});
