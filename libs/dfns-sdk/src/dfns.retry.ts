/** Retry helper with exponential backoff + jitter */

import { DfnsTransientError, DfnsPermanentError } from './dfns.errors';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 5,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
};

/**
 * Execute an async function with exponential backoff + jitter on transient errors.
 * Only retries DfnsTransientError; DfnsPermanentError and other errors propagate immediately.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {},
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_OPTIONS, ...opts };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof DfnsPermanentError) {
        throw err;
      }

      if (err instanceof DfnsTransientError) {
        lastError = err;
        if (attempt < maxRetries) {
          const delay = computeDelay(attempt, baseDelayMs, maxDelayMs ?? 30_000);
          await sleep(delay);
          continue;
        }
      }

      // Unknown error on first attempt — wrap and throw
      if (!(err instanceof DfnsTransientError)) {
        throw err;
      }
    }
  }

  throw lastError ?? new Error('Retry exhausted');
}

/** Exponential backoff with full jitter: random in [0, min(maxDelay, base * 2^attempt)] */
export function computeDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  return Math.floor(Math.random() * capped);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
