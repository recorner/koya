import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { RatesProvider } from './provider.interface';
import type { NormalizedRate, ProviderHealthCheck } from '../rates.types';
import {
  PROVIDER_BINANCE,
  BINANCE_SYMBOL_MAP,
  DEFAULT_CONFIDENCE,
  parsePair,
} from '../rates.constants';

const DEFAULT_BINANCE_API = 'https://data-api.binance.vision';

interface BinanceBookTicker {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

@Injectable()
export class BinanceProvider implements RatesProvider {
  private readonly logger = new Logger(BinanceProvider.name);
  private readonly baseUrl: string;
  readonly name = PROVIDER_BINANCE;
  readonly supportedPairs = Object.keys(BINANCE_SYMBOL_MAP);

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('BINANCE_API_URL', DEFAULT_BINANCE_API);
  }

  async getTicker(pair: string): Promise<NormalizedRate> {
    const symbol = BINANCE_SYMBOL_MAP[pair];
    if (!symbol) throw new Error(`Binance does not support pair: ${pair}`);

    const start = Date.now();
    const { data } = await axios.get<BinanceBookTicker>(
      `${this.baseUrl}/api/v3/ticker/bookTicker`,
      { params: { symbol }, timeout: 5000 },
    );
    const latencyMs = Date.now() - start;

    return this.normalize(pair, data, latencyMs);
  }

  async getMany(pairs: string[]): Promise<NormalizedRate[]> {
    const symbols = pairs
      .map((p) => BINANCE_SYMBOL_MAP[p])
      .filter(Boolean);

    if (symbols.length === 0) return [];

    const start = Date.now();
    const { data } = await axios.get<BinanceBookTicker[]>(
      `${this.baseUrl}/api/v3/ticker/bookTicker`,
      {
        params: { symbols: JSON.stringify(symbols) },
        timeout: 5000,
      },
    );
    const latencyMs = Date.now() - start;

    // Build reverse map: symbol → pair
    const symbolToPair: Record<string, string> = {};
    for (const [p, s] of Object.entries(BINANCE_SYMBOL_MAP)) {
      symbolToPair[s] = p;
    }

    return data
      .map((ticker) => {
        const pair = symbolToPair[ticker.symbol];
        if (!pair) return null;
        return this.normalize(pair, ticker, latencyMs);
      })
      .filter((r): r is NormalizedRate => r !== null);
  }

  async getHealth(): Promise<ProviderHealthCheck> {
    const start = Date.now();
    try {
      await axios.get(`${this.baseUrl}/api/v3/ping`, { timeout: 3000 });
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

  private normalize(
    pair: string,
    data: BinanceBookTicker,
    latencyMs: number,
  ): NormalizedRate {
    const { base, quote } = parsePair(pair);
    const bid = parseFloat(data.bidPrice);
    const ask = parseFloat(data.askPrice);
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
