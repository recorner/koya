import { Injectable, Logger } from '@nestjs/common';
import type { RatesProvider } from './provider.interface';
import type { NormalizedRate, ProviderHealthCheck } from '../rates.types';
import { PROVIDER_FX, DEFAULT_CONFIDENCE, parsePair } from '../rates.constants';

/**
 * FX provider for KES/USD.
 *
 * Starts as a mock with a realistic rate (~129 KES/USD).
 * Swap to a real FX provider (e.g. Open Exchange Rates, CurrencyLayer)
 * by implementing the RatesProvider interface and updating the module binding.
 */
@Injectable()
export class FxProvider implements RatesProvider {
  private readonly logger = new Logger(FxProvider.name);
  readonly name = PROVIDER_FX;
  readonly supportedPairs = ['KES/USD'];

  // USD/KES market rate (~129.5 KES per dollar) — inverted to KES/USD for output
  // KES/USD = 1/129.5 ≈ 0.00772 (1 KES = 0.00772 USD)
  private readonly usdKesRate = 129.5;
  private readonly spreadKes = 0.5; // spread in KES terms

  async getTicker(pair: string): Promise<NormalizedRate> {
    if (pair !== 'KES/USD') {
      throw new Error(`FX provider does not support pair: ${pair}`);
    }

    const start = Date.now();
    const rate = this.generateRate();
    const latencyMs = Date.now() - start;

    return rate.normalized(latencyMs);
  }

  async getMany(pairs: string[]): Promise<NormalizedRate[]> {
    const results: NormalizedRate[] = [];
    for (const pair of pairs) {
      if (pair === 'KES/USD') {
        results.push(await this.getTicker(pair));
      }
    }
    return results;
  }

  async getHealth(): Promise<ProviderHealthCheck> {
    return {
      provider: this.name,
      ok: true,
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  private generateRate() {
    // Add small jitter (±0.3%) to simulate live FX movement
    const jitter = 1 + (Math.random() - 0.5) * 0.006;
    const usdKes = this.usdKesRate * jitter;

    // Invert: KES/USD = 1 / USD_KES
    const mid = 1 / usdKes;
    const bid = 1 / (usdKes + this.spreadKes / 2);
    const ask = 1 / (usdKes - this.spreadKes / 2);
    const { base, quote } = parsePair('KES/USD');
    const now = new Date().toISOString();

    return {
      normalized: (latencyMs: number): NormalizedRate => ({
        pair: 'KES/USD',
        base,
        quote,
        bid,
        ask,
        mid,
        source: this.name,
        sourceTimestamp: now,
        receivedAt: now,
        latencyMs,
        confidence: DEFAULT_CONFIDENCE[this.name] ?? 0.5,
      }),
    };
  }
}
