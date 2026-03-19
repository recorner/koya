import { Injectable, Logger } from '@nestjs/common';
import type { RateProvider, RateResult } from './rate-provider.interface';
import { RatesService } from '../rates/rates.service';

/**
 * Live rate adapter — bridges the new multi-provider RatesService
 * into the legacy RateProvider interface used by QuoteService.
 *
 * Replaces MockRateProvider for production use.
 */
@Injectable()
export class LiveRateProvider implements RateProvider {
  private readonly logger = new Logger(LiveRateProvider.name);

  // Default spreads per route (fraction of mid price)
  private readonly SPREAD_MAP: Record<string, number> = {
    'KES/BTC': 0.015,
    'BTC/KES': 0.015,
    'KES/USDT': 0.01,
    'USDT/KES': 0.01,
    'KES/USDC': 0.01,
    'USDC/KES': 0.01,
  };
  private readonly DEFAULT_SPREAD = 0.01;

  constructor(private readonly ratesService: RatesService) {}

  async getRate(sourceAsset: string, targetAsset: string): Promise<RateResult> {
    const pair = `${sourceAsset}/${targetAsset}`;
    const snapshot = await this.ratesService.getRate(pair);

    if (!snapshot) {
      throw new Error(`No rate available for ${sourceAsset} → ${targetAsset}`);
    }

    // Convert mid price to a plain-decimal string (never scientific notation)
    // QuoteService parses on '.' and feeds digits straight to BigInt.
    const rate = this.toDecimalString(snapshot.mid, 18);
    const spread = (this.SPREAD_MAP[pair] ?? this.DEFAULT_SPREAD).toFixed(6);

    this.logger.debug(
      `Live rate ${pair}: mid=${rate}, spread=${spread}, sources=${snapshot.sources.join(',')}`,
    );

    return {
      rate,
      spread,
      timestamp: new Date(snapshot.calculatedAt),
    };
  }

  /**
   * Format a number as a plain decimal string — never scientific notation.
   * toFixed(18) guarantees "0.000000111400000000" instead of "1.114e-7".
   */
  private toDecimalString(value: number, decimals: number): string {
    const fixed = value.toFixed(decimals);
    // Strip trailing zeros after the decimal point, but keep at least one
    return fixed.replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '.0');
  }
}
