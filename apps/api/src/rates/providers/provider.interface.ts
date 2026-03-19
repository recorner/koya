import type { NormalizedRate, ProviderHealthCheck } from '../rates.types';

/**
 * Interface for external rate data providers.
 * Each exchange/FX source implements this.
 */
export interface RatesProvider {
  /** Unique provider name (e.g. 'binance', 'kraken', 'fx') */
  readonly name: string;

  /** Pairs this provider can serve */
  readonly supportedPairs: string[];

  /** Fetch a single ticker */
  getTicker(pair: string): Promise<NormalizedRate>;

  /** Fetch multiple tickers in one call (where the API supports it) */
  getMany(pairs: string[]): Promise<NormalizedRate[]>;

  /** Quick health probe */
  getHealth(): Promise<ProviderHealthCheck>;
}
