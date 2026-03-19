import { Injectable, Logger } from '@nestjs/common';
import type { RatesProvider } from '../providers/provider.interface';
import type { NormalizedRate, RateSnapshot } from '../rates.types';
import { RatesValidator } from './rates.validator';

/**
 * Aggregates rates from multiple providers into a single consensus snapshot.
 * Uses median of valid, non-stale provider mids.
 */
@Injectable()
export class RatesAggregator {
  private readonly logger = new Logger(RatesAggregator.name);

  constructor(private readonly validator: RatesValidator) {}

  /**
   * Fetch a pair from all providers that support it, validate,
   * and produce a single consensus RateSnapshot.
   */
  async aggregate(
    pair: string,
    providers: RatesProvider[],
  ): Promise<RateSnapshot | null> {
    const supporting = providers.filter((p) =>
      p.supportedPairs.includes(pair),
    );

    if (supporting.length === 0) {
      this.logger.warn(`No providers support pair ${pair}`);
      return null;
    }

    // Fetch from all providers in parallel
    const results = await Promise.allSettled(
      supporting.map((p) => p.getTicker(pair)),
    );

    const rates: NormalizedRate[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const provider = supporting[i]!;
      if (result.status === 'fulfilled') {
        const rate = result.value;
        if (this.validator.isValid(rate) && !this.validator.isStale(rate)) {
          rates.push(rate);
        } else {
          this.logger.warn(
            `Rejected rate from ${provider.name} for ${pair}: ` +
              `valid=${this.validator.isValid(rate)}, stale=${this.validator.isStale(rate)}`,
          );
        }
      } else {
        this.logger.warn(
          `Provider ${provider.name} failed for ${pair}: ${result.reason}`,
        );
      }
    }

    if (rates.length === 0) {
      this.logger.warn(`No valid rates for ${pair} from any provider`);
      return null;
    }

    // Check divergence across providers
    const divergence = this.validator.checkDivergence(rates);
    if (!divergence.ok) {
      this.logger.warn(
        `Divergence alert for ${pair}: ${(divergence.maxDivergence * 100).toFixed(2)}% — using median anyway`,
      );
    }

    return this.computeConsensus(pair, rates);
  }

  /**
   * Compute consensus from a set of validated NormalizedRate entries.
   * Uses median of mids for the final price.
   */
  private computeConsensus(
    pair: string,
    rates: NormalizedRate[],
  ): RateSnapshot {
    const mids = rates.map((r) => r.mid).sort((a, b) => a - b);
    const mid = median(mids);

    // Median of bids/asks if available
    const bids = rates.map((r) => r.bid).filter((b): b is number => b !== null);
    const asks = rates.map((r) => r.ask).filter((a): a is number => a !== null);
    const bid = bids.length > 0 ? median(bids.sort((a, b) => a - b)) : null;
    const ask = asks.length > 0 ? median(asks.sort((a, b) => a - b)) : null;

    const sources = [...new Set(rates.map((r) => r.source))];

    return {
      pair,
      mid,
      bid,
      ask,
      sourceCount: sources.length,
      sources,
      calculatedAt: new Date().toISOString(),
      stale: false,
      derived: false,
    };
  }
}

/**
 * Compute the median of a sorted array of numbers.
 */
function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[Math.floor(n / 2)]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}
