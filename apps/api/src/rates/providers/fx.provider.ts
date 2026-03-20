import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { RatesProvider } from './provider.interface';
import type { NormalizedRate, ProviderHealthCheck } from '../rates.types';
import { PROVIDER_FX, DEFAULT_CONFIDENCE, parsePair } from '../rates.constants';

/**
 * FX provider for KES/USD.
 *
 * Fetches real exchange rates from:
 *   1. Open Exchange Rates (if FX_API_KEY is configured)
 *   2. Free exchangerate-api.com endpoint (no key needed)
 *
 * Falls back to a deterministic mock rate (~129.5 KES/USD) if all
 * API calls fail — so the rates pipeline never breaks.
 */
@Injectable()
export class FxProvider implements RatesProvider {
  private readonly logger = new Logger(FxProvider.name);
  readonly name = PROVIDER_FX;
  readonly supportedPairs = ['KES/USD'];

  private readonly fxApiKey: string | undefined;
  private readonly fxApiUrl: string;

  // Fallback mock rate when APIs are unreachable
  private readonly FALLBACK_USD_KES = 129.5;
  private readonly SPREAD_KES = 0.5;

  constructor(private readonly config: ConfigService) {
    this.fxApiKey = this.config.get<string>('FX_API_KEY');
    this.fxApiUrl = this.config.get<string>(
      'FX_API_URL',
      'https://open.er-api.com/v6/latest/USD',
    );
  }

  async getTicker(pair: string): Promise<NormalizedRate> {
    if (pair !== 'KES/USD') {
      throw new Error(`FX provider does not support pair: ${pair}`);
    }

    const start = Date.now();
    const usdKes = await this.fetchUsdKes();
    const latencyMs = Date.now() - start;

    return this.buildNormalizedRate(usdKes, latencyMs);
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
    const start = Date.now();
    try {
      await this.fetchUsdKes();
      return {
        provider: this.name,
        ok: true,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return {
        provider: this.name,
        ok: false,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  // ── Rate fetching ─────────────────────────────────────────────

  private async fetchUsdKes(): Promise<number> {
    // 1. Try Open Exchange Rates (premium) if API key is configured
    if (this.fxApiKey) {
      try {
        return await this.fetchOpenExchangeRates();
      } catch (err) {
        this.logger.warn(`Open Exchange Rates failed, trying free API: ${err}`);
      }
    }

    // 2. Try free exchangerate-api.com endpoint
    try {
      return await this.fetchFreeApi();
    } catch (err) {
      this.logger.warn(`Free FX API failed, using fallback mock: ${err}`);
    }

    // 3. Deterministic fallback — never break the pipeline
    return this.FALLBACK_USD_KES;
  }

  /**
   * Open Exchange Rates: https://openexchangerates.org/api/latest.json?app_id=KEY
   */
  private async fetchOpenExchangeRates(): Promise<number> {
    const url = this.fxApiUrl.includes('openexchangerates.org')
      ? this.fxApiUrl
      : 'https://openexchangerates.org/api/latest.json';

    const { data } = await axios.get<{ rates: Record<string, number> }>(url, {
      params: { app_id: this.fxApiKey, symbols: 'KES' },
      timeout: 5000,
    });

    const kes = data?.rates?.KES;
    if (typeof kes !== 'number' || kes <= 0) {
      throw new Error('Invalid KES rate from Open Exchange Rates');
    }

    this.logger.debug(`Open Exchange Rates USD/KES: ${kes}`);
    return kes;
  }

  /**
   * Free exchangerate-api.com: https://open.er-api.com/v6/latest/USD
   * No API key required, ~1500 req/month on free tier.
   */
  private async fetchFreeApi(): Promise<number> {
    const { data } = await axios.get<{ rates: Record<string, number> }>(
      'https://open.er-api.com/v6/latest/USD',
      { timeout: 5000 },
    );

    const kes = data?.rates?.KES;
    if (typeof kes !== 'number' || kes <= 0) {
      throw new Error('Invalid KES rate from free FX API');
    }

    this.logger.debug(`Free FX API USD/KES: ${kes}`);
    return kes;
  }

  // ── Normalization ─────────────────────────────────────────────

  private buildNormalizedRate(usdKes: number, latencyMs: number): NormalizedRate {
    // Invert: KES/USD = 1 / USD_KES
    const mid = 1 / usdKes;
    const bid = 1 / (usdKes + this.SPREAD_KES / 2);
    const ask = 1 / (usdKes - this.SPREAD_KES / 2);
    const { base, quote } = parsePair('KES/USD');
    const now = new Date().toISOString();

    return {
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
      confidence: this.fxApiKey ? 0.95 : DEFAULT_CONFIDENCE[this.name] ?? 0.8,
    };
  }
}
