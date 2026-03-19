/**
 * Rates module constants — pairs, thresholds, and DI tokens.
 */

// ── Direct (source-fed) pairs ───────────────────────────────────
export const DIRECT_PAIRS = [
  'BTC/USD',
  'BTC/USDT',
  'BTC/USDC',
  'USDT/USD',
  'USDC/USD',
  'KES/USD',
] as const;

// ── Derived pairs (computed through intermediaries) ─────────────
export const DERIVED_PAIRS = [
  'KES/BTC',
  'KES/USDT',
  'KES/USDC',
  'BTC/KES',
  'USDT/KES',
  'USDC/KES',
  'USDT/USDC',
] as const;

export const ALL_PAIRS = [...DIRECT_PAIRS, ...DERIVED_PAIRS] as const;

// ── Derivation routes ───────────────────────────────────────────
// Each derived pair is computed by multiplying the rates of its legs.
// e.g. KES/BTC: first get KES→USD rate, then USD→BTC rate (= 1/BTC_USD).
// The route builder interprets these as: result = leg[0].mid * leg[1].mid
// where a leg like "!BTC/USD" means use the inverse (1 / BTC_USD.mid).
export const DERIVATION_ROUTES: Record<string, string[]> = {
  'KES/BTC': ['KES/USD', '!BTC/USD'],
  'KES/USDT': ['KES/USD', '!USDT/USD'],
  'KES/USDC': ['KES/USD', '!USDC/USD'],
  'BTC/KES': ['BTC/USD', '!KES/USD'],
  'USDT/KES': ['USDT/USD', '!KES/USD'],
  'USDC/KES': ['USDC/USD', '!KES/USD'],
  'USDT/USDC': ['USDT/USD', '!USDC/USD'],
};

// ── Staleness thresholds (seconds) ──────────────────────────────
export const STALENESS = {
  /** Crypto rate is stale after this many seconds */
  CRYPTO: 10,
  /** Fiat FX rate is stale after this many seconds */
  FIAT: 300,
  /** Per-pair override: KES/USD is fiat */
  FIAT_PAIRS: ['KES/USD'] as string[],
} as const;

// ── Divergence tolerance ────────────────────────────────────────
/** Maximum allowed divergence between providers (fraction, e.g. 0.02 = 2%) */
export const MAX_DIVERGENCE = 0.02;

// ── Provider names ──────────────────────────────────────────────
export const PROVIDER_BINANCE = 'binance';
export const PROVIDER_KRAKEN = 'kraken';
export const PROVIDER_FX = 'fx';

// ── Pair mapping: which providers support which pairs ───────────
export const PROVIDER_PAIR_SUPPORT: Record<string, string[]> = {
  [PROVIDER_BINANCE]: ['BTC/USDT', 'BTC/USDC', 'USDT/USDC'],
  [PROVIDER_KRAKEN]: ['BTC/USD', 'USDT/USD', 'USDC/USD'],
  [PROVIDER_FX]: ['KES/USD'],
};

// ── Binance pair symbol mapping ─────────────────────────────────
export const BINANCE_SYMBOL_MAP: Record<string, string> = {
  'BTC/USDT': 'BTCUSDT',
  'BTC/USDC': 'BTCUSDC',
  'USDT/USDC': 'USDTUSDC',
};

// ── Kraken pair symbol mapping ──────────────────────────────────
export const KRAKEN_SYMBOL_MAP: Record<string, string> = {
  'BTC/USD': 'XXBTZUSD',
  'USDT/USD': 'USDTZUSD',
  'USDC/USD': 'USDCUSD',
};

// ── Default confidence scores ───────────────────────────────────
export const DEFAULT_CONFIDENCE: Record<string, number> = {
  [PROVIDER_BINANCE]: 0.9,
  [PROVIDER_KRAKEN]: 0.85,
  [PROVIDER_FX]: 0.8,
};

/**
 * Parse a pair string "BTC/USD" into base and quote.
 */
export function parsePair(pair: string): { base: string; quote: string } {
  const parts = pair.split('/');
  return { base: parts[0] ?? '', quote: parts[1] ?? '' };
}

/**
 * Check if a pair is directly sourced (not derived).
 */
export function isDirectPair(pair: string): boolean {
  return (DIRECT_PAIRS as readonly string[]).includes(pair);
}

/**
 * Check if a pair is derived.
 */
export function isDerivedPair(pair: string): boolean {
  return pair in DERIVATION_ROUTES;
}

/**
 * Determine staleness threshold for a pair in seconds.
 */
export function stalenessThreshold(pair: string): number {
  if (STALENESS.FIAT_PAIRS.includes(pair)) return STALENESS.FIAT;
  return STALENESS.CRYPTO;
}
