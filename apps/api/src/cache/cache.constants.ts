/** DI token for the ioredis client instance */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Key namespace prefixes — all Redis keys MUST use these.
 * Format: `namespace:identifier`
 */
export const CacheNamespace = {
  SESSION: 'session',
  RATES_SPOT: 'rates:spot',
  RATES_DERIVED: 'rates:derived',
  RATES_LASTGOOD: 'rates:lastgood',
  QUOTE: 'quote',
  QUOTE_LOCK: 'quote_lock',
  IDEMPOTENCY: 'idempotency',
  PROVIDER_HEALTH: 'provider_health',
  LOCK: 'lock',
} as const;

/**
 * Default TTL values in seconds.
 * Overridable via environment variables.
 */
export const DefaultTTL = {
  /** Crypto spot price: 2–5 seconds */
  CRYPTO_SPOT: 5,
  /** FX fiat rate: 30–120 seconds */
  FX_RATE: 60,
  /** Derived conversion rates: same as underlying */
  DERIVED_RATE: 60,
  /** Quotes: 30 seconds */
  QUOTE: 30,
  /** Provider health flags: 60 seconds */
  PROVIDER_HEALTH: 60,
  /** Distributed locks: 10 seconds */
  LOCK: 10,
} as const;

/**
 * Build a namespaced Redis key.
 *
 * @example buildKey(CacheNamespace.QUOTE, 'abc-123') → 'quote:abc-123'
 * @example buildKey(CacheNamespace.RATES_SPOT, 'KES/BTC') → 'rates:spot:KES/BTC'
 */
export function buildKey(namespace: string, id: string): string {
  return `${namespace}:${id}`;
}
