import { Logger } from '@nestjs/common';
import { RatesService } from '../rates.service';
import { RatesAggregator } from '../aggregation/rates.aggregator';
import { RatesRouteBuilder } from '../aggregation/rates.route-builder';
import { RatesValidator } from '../aggregation/rates.validator';
import { RatesCache } from '../cache/rates.cache';
import { RatesHealth } from '../health/rates.health';
import type { RatesProvider } from '../providers/provider.interface';
import type { NormalizedRate, RateSnapshot } from '../rates.types';

// Suppress expected WARN/ERROR log noise during unit tests
beforeAll(() => Logger.overrideLogger(false));

function makeSnapshot(pair: string, mid: number, overrides: Partial<RateSnapshot> = {}): RateSnapshot {
  return {
    pair,
    mid,
    bid: mid * 0.999,
    ask: mid * 1.001,
    sourceCount: 1,
    sources: ['test'],
    calculatedAt: new Date().toISOString(),
    stale: false,
    derived: false,
    ...overrides,
  };
}

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
    getMany: jest.fn(async () => []),
    getHealth: jest.fn(async () => ({ provider: name, ok: true, latencyMs: 10, checkedAt: new Date().toISOString() })),
  };
}

describe('RatesService', () => {
  let service: RatesService;
  let ratesCache: jest.Mocked<RatesCache>;
  let health: jest.Mocked<RatesHealth>;
  let providers: RatesProvider[];

  beforeEach(() => {
    ratesCache = {
      getSpot: jest.fn().mockResolvedValue(null),
      setSpot: jest.fn().mockResolvedValue(true),
      getDerived: jest.fn().mockResolvedValue(null),
      setDerived: jest.fn().mockResolvedValue(true),
      getLastGood: jest.fn().mockResolvedValue(null),
      setLastGood: jest.fn().mockResolvedValue(true),
      getProviderHealth: jest.fn().mockResolvedValue(null),
      setProviderHealth: jest.fn().mockResolvedValue(true),
      isSnapshotStale: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<RatesCache>;

    health = {
      check: jest.fn().mockResolvedValue({ status: 'ok' }),
    } as unknown as jest.Mocked<RatesHealth>;

    providers = [
      mockProvider('kraken', ['BTC/USD', 'USDT/USD', 'USDC/USD'], {
        'BTC/USD': makeRate(87450, 'kraken', 'BTC/USD'),
        'USDT/USD': makeRate(1.0001, 'kraken', 'USDT/USD'),
        'USDC/USD': makeRate(0.9999, 'kraken', 'USDC/USD'),
      }),
      mockProvider('binance', ['BTC/USDT', 'BTC/USDC', 'USDT/USDC'], {
        'BTC/USDT': makeRate(87460, 'binance', 'BTC/USDT'),
        'BTC/USDC': makeRate(87455, 'binance', 'BTC/USDC'),
        'USDT/USDC': makeRate(1.0002, 'binance', 'USDT/USDC'),
      }),
      mockProvider('fx', ['KES/USD'], {
        'KES/USD': makeRate(0.00775, 'fx', 'KES/USD'),
      }),
    ];

    const validator = new RatesValidator();
    const aggregator = new RatesAggregator(validator);
    const routeBuilder = new RatesRouteBuilder();

    service = new RatesService(
      providers,
      aggregator,
      routeBuilder,
      validator,
      ratesCache,
      health,
    );
  });

  // ── Direct pair resolution ─────────────────────────────

  describe('getRate (direct)', () => {
    it('should return cached rate if fresh', async () => {
      const cached = makeSnapshot('BTC/USD', 87450);
      ratesCache.getSpot.mockResolvedValue(cached);

      const result = await service.getRate('BTC/USD');
      expect(result).toEqual(cached);
      // Should NOT have called providers
      expect(providers[0]!.getTicker).not.toHaveBeenCalled();
    });

    it('should fetch from providers on cache miss', async () => {
      ratesCache.getSpot.mockResolvedValue(null);

      const result = await service.getRate('BTC/USD');
      expect(result).not.toBeNull();
      expect(result!.pair).toBe('BTC/USD');
      expect(ratesCache.setSpot).toHaveBeenCalled();
      expect(ratesCache.setLastGood).toHaveBeenCalled();
    });

    it('should refresh when cached rate is stale', async () => {
      const stale = makeSnapshot('BTC/USD', 87000);
      ratesCache.getSpot.mockResolvedValue(stale);
      ratesCache.isSnapshotStale.mockReturnValue(true);

      const result = await service.getRate('BTC/USD');
      expect(result).not.toBeNull();
      expect(ratesCache.setSpot).toHaveBeenCalled();
    });

    it('should fall back to last-good when providers fail', async () => {
      const lastGood = makeSnapshot('BTC/USD', 86000);
      ratesCache.getSpot.mockResolvedValue(null);
      ratesCache.getLastGood.mockResolvedValue(lastGood);

      // Make all providers fail
      for (const p of providers) {
        (p.getTicker as jest.Mock).mockRejectedValue(new Error('down'));
      }

      const result = await service.getRate('BTC/USD');
      expect(result).not.toBeNull();
      expect(result!.mid).toBe(86000);
      expect(result!.stale).toBe(true);
    });

    it('should return null when no providers and no fallback', async () => {
      ratesCache.getSpot.mockResolvedValue(null);
      ratesCache.getLastGood.mockResolvedValue(null);

      for (const p of providers) {
        (p.getTicker as jest.Mock).mockRejectedValue(new Error('down'));
      }

      const result = await service.getRate('BTC/USD');
      expect(result).toBeNull();
    });
  });

  // ── Derived pair resolution ────────────────────────────

  describe('getRate (derived)', () => {
    it('should return cached derived rate if fresh', async () => {
      const cached = makeSnapshot('KES/BTC', 8.86e-8, { derived: true });
      ratesCache.getDerived.mockResolvedValue(cached);

      const result = await service.getRate('KES/BTC');
      expect(result).toEqual(cached);
    });

    it('should compute derived rate on cache miss', async () => {
      ratesCache.getDerived.mockResolvedValue(null);

      const result = await service.getRate('KES/BTC');
      expect(result).not.toBeNull();
      expect(result!.pair).toBe('KES/BTC');
      expect(result!.derived).toBe(true);
      expect(ratesCache.setDerived).toHaveBeenCalled();
    });

    it('should fall back to last-good derived when legs are unavailable', async () => {
      const lastGood = makeSnapshot('KES/BTC', 8.5e-8, { derived: true });
      ratesCache.getDerived.mockResolvedValue(null);
      ratesCache.getLastGood.mockResolvedValue(lastGood);

      // Make the KES/USD provider fail
      const fxProvider = providers[2]!;
      (fxProvider.getTicker as jest.Mock).mockRejectedValue(new Error('FX down'));

      const result = await service.getRate('KES/BTC');
      expect(result).not.toBeNull();
      expect(result!.stale).toBe(true);
    });
  });

  // ── getAllRates ────────────────────────────────────────

  describe('getAllRates', () => {
    it('should return rates for all supported pairs', async () => {
      const results = await service.getAllRates();
      // Should have results for at least the direct pairs that have providers
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ── Unsupported pair ──────────────────────────────────

  describe('unsupported pair', () => {
    it('should return null for an unknown pair', async () => {
      const result = await service.getRate('ETH/BRL');
      expect(result).toBeNull();
    });
  });

  // ── Health ────────────────────────────────────────────

  describe('getHealthReport', () => {
    it('should delegate to RatesHealth', async () => {
      await service.getHealthReport();
      expect(health.check).toHaveBeenCalledWith(providers);
    });
  });
});
