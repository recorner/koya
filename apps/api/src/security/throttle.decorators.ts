import { Throttle, SkipThrottle } from '@nestjs/throttler';

/**
 * Named throttler policies.
 * These decorators override the default limits for specific endpoint classes.
 *
 * Usage: @QuoteThrottle() on a controller method or class
 */

/** Quote/session creation: 20 req/min/IP (tight — prevents abuse) */
export const QuoteThrottle = () =>
  Throttle({ default: { limit: 20, ttl: 60000 } });

/** Status polling: 60 req/min/IP (looser — frequent polling expected) */
export const StatusThrottle = () =>
  Throttle({ default: { limit: 60, ttl: 60000 } });

/** Identity/payout submission: 10 req/min/IP (tightest — sensitive data) */
export const SubmitThrottle = () =>
  Throttle({ default: { limit: 10, ttl: 60000 } });

/** Payment initiation: 10 req/min/IP (sensitive — triggers STK push) */
export const PaymentThrottle = () =>
  Throttle({ default: { limit: 10, ttl: 60000 } });

/** Webhook callbacks: 120 req/min/IP (loose — provider traffic) */
export const WebhookThrottle = () =>
  Throttle({ default: { limit: 120, ttl: 60000 } });

/** Skip throttling entirely (health, internal) */
export const NoThrottle = () => SkipThrottle({ default: true });
