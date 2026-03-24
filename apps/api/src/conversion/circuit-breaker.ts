import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Redis key prefix */
  name: string;
  /** Max failures before opening circuit */
  failureThreshold: number;
  /** Window in seconds to count failures */
  failureWindowSecs: number;
  /** How long the circuit stays open before half-open probe */
  openDurationSecs: number;
}

const DEFAULTS: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5,
  failureWindowSecs: 600, // 10 minutes
  openDurationSecs: 900,  // 15 minutes
};

/**
 * Redis-backed circuit breaker for external service calls.
 *
 * Keys used:
 *   koya:cb:{name}:failures  — sorted set of failure timestamps
 *   koya:cb:{name}:open_until — string with epoch when circuit closes
 */
export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private readonly config: CircuitBreakerConfig;
  private readonly keyPrefix: string;

  constructor(
    private readonly redis: Redis | null,
    config: Partial<CircuitBreakerConfig> & { name: string },
  ) {
    this.config = { ...DEFAULTS, ...config };
    this.keyPrefix = `koya:cb:${this.config.name}`;
  }

  async getState(): Promise<CircuitState> {
    if (!this.redis) return 'closed';

    const openUntil = await this.redis.get(`${this.keyPrefix}:open_until`);
    if (openUntil) {
      const openUntilMs = parseInt(openUntil, 10);
      if (Date.now() < openUntilMs) {
        return 'open';
      }
      // Expired — transition to half-open
      return 'half-open';
    }
    return 'closed';
  }

  async canExecute(): Promise<boolean> {
    const state = await this.getState();
    if (state === 'open') {
      this.logger.warn(`Circuit ${this.config.name} is OPEN — rejecting request`);
      return false;
    }
    // closed or half-open: allow
    return true;
  }

  async recordSuccess(): Promise<void> {
    if (!this.redis) return;

    // If half-open and success, close the circuit
    const state = await this.getState();
    if (state === 'half-open') {
      await this.redis.del(`${this.keyPrefix}:open_until`);
      await this.redis.del(`${this.keyPrefix}:failures`);
      this.logger.log(`Circuit ${this.config.name} CLOSED after successful probe`);
    }
  }

  async recordFailure(): Promise<void> {
    if (!this.redis) return;

    const now = Date.now();
    const windowStart = now - this.config.failureWindowSecs * 1000;

    // Add failure timestamp
    await this.redis.zadd(`${this.keyPrefix}:failures`, now, String(now));
    // Remove old failures outside window
    await this.redis.zremrangebyscore(`${this.keyPrefix}:failures`, '-inf', windowStart);
    // Set TTL on the failures key to avoid Redis bloat
    await this.redis.expire(`${this.keyPrefix}:failures`, this.config.failureWindowSecs * 2);

    // Count recent failures
    const failureCount = await this.redis.zcard(`${this.keyPrefix}:failures`);

    if (failureCount >= this.config.failureThreshold) {
      const openUntil = now + this.config.openDurationSecs * 1000;
      await this.redis.set(
        `${this.keyPrefix}:open_until`,
        String(openUntil),
        'EX',
        this.config.openDurationSecs,
      );
      this.logger.error(
        `Circuit ${this.config.name} OPENED — ${failureCount} failures in ${this.config.failureWindowSecs}s, ` +
        `will reopen at ${new Date(openUntil).toISOString()}`,
      );
    }
  }
}
