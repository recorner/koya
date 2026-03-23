import { retryWithBackoff, computeDelay } from '../dfns.retry';
import { DfnsTransientError, DfnsPermanentError } from '../dfns.errors';

describe('dfns.retry', () => {
  describe('computeDelay', () => {
    it('should return a value between 0 and base * 2^attempt', () => {
      // With random jitter, just verify it's within bounds
      for (let i = 0; i < 100; i++) {
        const delay = computeDelay(0, 500, 30_000);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(500);
      }
    });

    it('should respect maxDelay cap', () => {
      for (let i = 0; i < 100; i++) {
        const delay = computeDelay(10, 500, 1000);
        expect(delay).toBeLessThanOrEqual(1000);
      }
    });

    it('should increase exponentially (uncapped)', () => {
      // For attempt=3, base=100, max=100000: exponential = 100 * 8 = 800
      // delay in [0, 800]
      const delays = Array.from({ length: 100 }, () => computeDelay(3, 100, 100_000));
      const maxObserved = Math.max(...delays);
      expect(maxObserved).toBeLessThanOrEqual(800);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValueOnce('ok');
      const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on DfnsTransientError and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new DfnsTransientError('retry me', 500))
        .mockResolvedValueOnce('ok');

      const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries on DfnsTransientError', async () => {
      const fn = jest.fn().mockRejectedValue(new DfnsTransientError('always fail', 500));

      await expect(
        retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 }),
      ).rejects.toThrow(DfnsTransientError);
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should not retry on DfnsPermanentError', async () => {
      const fn = jest.fn().mockRejectedValueOnce(new DfnsPermanentError('permanent', 400));

      await expect(
        retryWithBackoff(fn, { maxRetries: 5, baseDelayMs: 1 }),
      ).rejects.toThrow(DfnsPermanentError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on non-Dfns errors', async () => {
      const fn = jest.fn().mockRejectedValueOnce(new Error('unexpected'));

      await expect(
        retryWithBackoff(fn, { maxRetries: 5, baseDelayMs: 1 }),
      ).rejects.toThrow('unexpected');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
