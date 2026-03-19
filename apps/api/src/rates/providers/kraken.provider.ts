import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { RatesProvider } from './provider.interface';
import type { NormalizedRate, ProviderHealthCheck } from '../rates.types';
import {
  PROVIDER_KRAKEN,
  KRAKEN_SYMBOL_MAP,
  DEFAULT_CONFIDENCE,
  parsePair,
} from '../rates.constants';

const DEFAULT_KRAKEN_API = 'https://api.kraken.com';

interface KrakenTickerEntry {
  /** Ask: [price, wholeLotVolume, lotVolume] */
  a: [string, string, string];
  /** Bid: [price, wholeLotVolume, lotVolume] */
  b: [string, string, string];
  /** Last trade: [price, volume] */
  c: [string, string];
}

interface KrakenTickerResponse {
  error: string[];
  result: Record<string, KrakenTickerEntry>;
}

@Injectable()
export class KrakenProvider implements RatesProvider {
  private readonly logger = new Logger(KrakenProvider.name);
  private readonly baseUrl: string;
  readonly name = PROVIDER_KRAKEN;
  readonly supportedPairs = Object.keys(KRAKEN_SYMBOL_MAP);

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('KRAKEN_API_URL', DEFAULT_KRAKEN_API);
  }

  async getTicker(pair: string): Promise<NormalizedRate> {
    const krakenPair = KRAKEN_SYMBOL_MAP[pair];
    if (!krakenPair) throw new Error(`Kraken does not support pair: ${pair}`);

    const start = Date.now();
    const { data } = await axios.get<KrakenTickerResponse>(
      `${this.baseUrl}/0/public/Ticker`,
      { params: { pair: krakenPair }, timeout: 5000 },
    );
    const latencyMs = Date.now() - start;

    if (data.error?.length) {
      throw new Error(`Kraken API error: ${data.error.join(', ')}`);
    }

    const entry = Object.values(data.result)[0];
    if (!entry) throw new Error(`No ticker data for ${pair}`);

    return this.normalize(pair, entry, latencyMs);
  }

  async getMany(pairs: string[]): Promise<NormalizedRate[]> {
    const krakenPairs = pairs
      .map((p) => KRAKEN_SYMBOL_MAP[p])
      .filter(Boolean);

    if (krakenPairs.length === 0) return [];

    const start = Date.now();
    const { data } = await axios.get<KrakenTickerResponse>(
      `${this.baseUrl}/0/public/Ticker`,
      { params: { pair: krakenPairs.join(',') }, timeout: 5000 },
    );
    const latencyMs = Date.now() - start;

    if (data.error?.length) {
      this.logger.warn(`Kraken API errors: ${data.error.join(', ')}`);
    }

    // Build reverse map: krakenSymbol → pair
    const symbolToPair: Record<string, string> = {};
    for (const [p, s] of Object.entries(KRAKEN_SYMBOL_MAP)) {
      symbolToPair[s] = p;
    }

    const results: NormalizedRate[] = [];
    for (const [symbol, entry] of Object.entries(data.result)) {
      const pair = symbolToPair[symbol];
      if (!pair) continue;
      results.push(this.normalize(pair, entry, latencyMs));
    }
    return results;
  }

  async getHealth(): Promise<ProviderHealthCheck> {
    const start = Date.now();
    try {
      const { data } = await axios.get<{ error: string[]; result: { unixtime: number } }>(
        `${this.baseUrl}/0/public/Time`,
        { timeout: 3000 },
      );
      return {
        provider: this.name,
        ok: data.error.length === 0,
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

  private normalize(
    pair: string,
    entry: KrakenTickerEntry,
    latencyMs: number,
  ): NormalizedRate {
    const { base, quote } = parsePair(pair);
    const bid = parseFloat(entry.b[0]);
    const ask = parseFloat(entry.a[0]);
    const mid = (bid + ask) / 2;
    const now = new Date().toISOString();

    return {
      pair,
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
    };
  }
}
