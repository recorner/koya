import { Logger } from '@nestjs/common';
import { RatesAggregator } from '../aggregation/rates.aggregator';
import { RatesValidator } from '../aggregation/rates.validator';

// Suppress expected WARN/ERROR log noise during unit tests
beforeAll(() => Logger.overrideLogger(false));
import type { RatesProvider } from '../providers/provider.interface';
import type { NormalizedRate } from '../rates.types';

function makeRate(mid: number, source: string, pair = 'BTC/USD'): NormalizedRate {
  return {
    pair,
    base: 'BTC',
    quote: 'USD',
    bid: mid * 0.999,
    ask: mid * 1.001,
    mid,
    source,
    sourceTimestamp: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    latencyMs: 50,
    confidence: 0.9,
  };
}

function mockProvider(name: string, pairs: string[], rates: Record<string, NormalizedRate>): RatesProvider {
  return {
    name,
    supportedPairs: pairs,
    getTicker: jest.fn(async (pair: string) => {
      const r = rates[pair];
      if (!r) throw new Error(`No rate for ${pair}`);
      return r;
    }),
    getMany: jest.fn(async (ps: string[]) => ps.map((p) => rates[p]).filter(Boolean) as NormalizedRate[]),
    getHealth: jest.fn(async () => ({ provider: name, ok: true, latencyMs: 10, checkedAt: new Date().toISOString() })),
  };
}

describe('RatesAggregator', () => {
  let aggregator: RatesAggregator;
  let validator: RatesValidator;

  beforeEach(() => {
    validator = new RatesValidator();
    aggregator = new RatesAggregator(validator);
  });

  it('should aggregate from a single provider', async () => {
    const provider = mockProvider('binance', ['BTC/USD'], {
      'BTC/USD': makeRate(87450, 'binance'),
    });

    const result = await aggregator.aggregate('BTC/USD', [provider]);
    expect(result).not.toBeNull();
    expect(result!.pair).toBe('BTC/USD');
    expect(result!.mid).toBe(87450);
    expect(result!.sources).toEqual(['binance']);
    expect(result!.derived).toBe(false);
  });

  it('should compute median from two providers', async () => {
    const p1 = mockProvider('binance', ['BTC/USD'], {
      'BTC/USD': makeRate(87400, 'binance'),
    });
    const p2 = mockProvider('kraken', ['BTC/USD'], {
      'BTC/USD': makeRate(87500, 'kraken'),
    });

    const result = await aggregator.aggregate('BTC/USD', [p1, p2]);
    expect(result).not.toBeNull();
    expect(result!.mid).toBe(87450); // median of 87400, 87500
    expect(result!.sourceCount).toBe(2);
  });

  it('should compute median from three providers', async () => {
    const p1 = mockProvider('a', ['BTC/USD'], { 'BTC/USD': makeRate(87400, 'a') });
    const p2 = mockProvider('b', ['BTC/USD'], { 'BTC/USD': makeRate(87500, 'b') });
    const p3 = mockProvider('c', ['BTC/USD'], { 'BTC/USD': makeRate(87600, 'c') });

    const result = await aggregator.aggregate('BTC/USD', [p1, p2, p3]);
    expect(result).not.toBeNull();
    expect(result!.mid).toBe(87500); // median of 3 values
  });

  it('should skip providers that do not support the pair', async () => {
    const p1 = mockProvider('binance', ['BTC/USDT'], {}); // doesn't support BTC/USD
    const p2 = mockProvider('kraken', ['BTC/USD'], {
      'BTC/USD': makeRate(87450, 'kraken'),
    });

    const result = await aggregator.aggregate('BTC/USD', [p1, p2]);
    expect(result).not.toBeNull();
    expect(result!.sources).toEqual(['kraken']);
    expect(p1.getTicker).not.toHaveBeenCalled();
  });

  it('should handle provider failure gracefully', async () => {
    const failing: RatesProvider = {
      name: 'broken',
      supportedPairs: ['BTC/USD'],
      getTicker: jest.fn().mockRejectedValue(new Error('Network error')),
      getMany: jest.fn().mockRejectedValue(new Error('Network error')),
      getHealth: jest.fn(async () => ({ provider: 'broken', ok: false, latencyMs: 0, checkedAt: new Date().toISOString() })),
    };
    const working = mockProvider('kraken', ['BTC/USD'], {
      'BTC/USD': makeRate(87450, 'kraken'),
    });

    const result = await aggregator.aggregate('BTC/USD', [failing, working]);
    expect(result).not.toBeNull();
    expect(result!.sources).toEqual(['kraken']);
  });

  it('should return null when no providers support the pair', async () => {
    const p1 = mockProvider('binance', ['BTC/USDT'], {});
    const result = await aggregator.aggregate('ETH/USD', [p1]);
    expect(result).toBeNull();
  });

  it('should return null when all providers fail', async () => {
    const failing: RatesProvider = {
      name: 'broken',
      supportedPairs: ['BTC/USD'],
      getTicker: jest.fn().mockRejectedValue(new Error('fail')),
      getMany: jest.fn().mockRejectedValue(new Error('fail')),
      getHealth: jest.fn(async () => ({ provider: 'broken', ok: false, latencyMs: 0, checkedAt: new Date().toISOString() })),
    };

    const result = await aggregator.aggregate('BTC/USD', [failing]);
    expect(result).toBeNull();
  });

  it('should reject stale rates from providers', async () => {
    const staleRate = makeRate(87450, 'binance');
    staleRate.receivedAt = new Date(Date.now() - 30000).toISOString(); // 30s old for crypto

    const provider = mockProvider('binance', ['BTC/USD'], {
      'BTC/USD': staleRate,
    });

    const result = await aggregator.aggregate('BTC/USD', [provider]);
    expect(result).toBeNull(); // stale rate rejected, no valid rates left
  });

  it('should still aggregate when divergence exceeds threshold (with warning)', async () => {
    // 3% divergence — beyond MAX_DIVERGENCE (2%)
    const p1 = mockProvider('a', ['BTC/USD'], { 'BTC/USD': makeRate(87000, 'a') });
    const p2 = mockProvider('b', ['BTC/USD'], { 'BTC/USD': makeRate(89700, 'b') });

    const result = await aggregator.aggregate('BTC/USD', [p1, p2]);
    // Should still return a result (median), but with a logged warning
    expect(result).not.toBeNull();
    expect(result!.mid).toBe((87000 + 89700) / 2);
  });
});
