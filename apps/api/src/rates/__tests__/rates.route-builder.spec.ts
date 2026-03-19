import { Logger } from '@nestjs/common';
import { RatesRouteBuilder } from '../aggregation/rates.route-builder';

// Suppress expected WARN log noise during unit tests
beforeAll(() => Logger.overrideLogger(false));
import type { RateSnapshot } from '../rates.types';

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

describe('RatesRouteBuilder', () => {
  let builder: RatesRouteBuilder;

  beforeEach(() => {
    builder = new RatesRouteBuilder();
  });

  // ── getRoute ────────────────────────────────────────────────

  describe('getRoute', () => {
    it('should return route for KES/BTC', () => {
      expect(builder.getRoute('KES/BTC')).toEqual(['KES/USD', '!BTC/USD']);
    });

    it('should return route for BTC/KES', () => {
      expect(builder.getRoute('BTC/KES')).toEqual(['BTC/USD', '!KES/USD']);
    });

    it('should return route for KES/USDT', () => {
      expect(builder.getRoute('KES/USDT')).toEqual(['KES/USD', '!USDT/USD']);
    });

    it('should return route for USDT/KES', () => {
      expect(builder.getRoute('USDT/KES')).toEqual(['USDT/USD', '!KES/USD']);
    });

    it('should return route for USDT/USDC', () => {
      expect(builder.getRoute('USDT/USDC')).toEqual(['USDT/USD', '!USDC/USD']);
    });

    it('should return null for a direct pair', () => {
      expect(builder.getRoute('BTC/USD')).toBeNull();
    });

    it('should return null for an unknown pair', () => {
      expect(builder.getRoute('ETH/USD')).toBeNull();
    });
  });

  // ── getRequiredDirectPairs ──────────────────────────────────

  describe('getRequiredDirectPairs', () => {
    it('should strip inversion prefix', () => {
      expect(builder.getRequiredDirectPairs('KES/BTC')).toEqual(['KES/USD', 'BTC/USD']);
    });

    it('should return empty for non-derived pair', () => {
      expect(builder.getRequiredDirectPairs('BTC/USD')).toEqual([]);
    });
  });

  // ── derive ──────────────────────────────────────────────────

  describe('derive', () => {
    it('should derive KES/BTC correctly', () => {
      // KES/BTC = KES/USD × (1 / BTC/USD)
      // KES/USD mid = 0.00775 (i.e. 1 KES = 0.00775 USD → ~129 KES/USD)
      // BTC/USD mid = 87450
      // Expected: 0.00775 / 87450 ≈ 8.862e-8
      const legs = new Map<string, RateSnapshot>();
      legs.set('KES/USD', makeSnapshot('KES/USD', 0.00775));
      legs.set('BTC/USD', makeSnapshot('BTC/USD', 87450));

      const result = builder.derive('KES/BTC', legs);
      expect(result).not.toBeNull();
      expect(result!.pair).toBe('KES/BTC');
      expect(result!.derived).toBe(true);
      expect(result!.mid).toBeCloseTo(0.00775 / 87450, 12);
      expect(result!.route).toEqual(['KES/USD', '!BTC/USD']);
    });

    it('should derive BTC/KES correctly', () => {
      // BTC/KES = BTC/USD × (1 / KES/USD)
      // BTC/USD mid = 87450
      // KES/USD mid = 0.00775 → 1/0.00775 = 129.03...
      // Expected: 87450 / 0.00775 ≈ 11,283,870.97
      const legs = new Map<string, RateSnapshot>();
      legs.set('BTC/USD', makeSnapshot('BTC/USD', 87450));
      legs.set('KES/USD', makeSnapshot('KES/USD', 0.00775));

      const result = builder.derive('BTC/KES', legs);
      expect(result).not.toBeNull();
      expect(result!.mid).toBeCloseTo(87450 / 0.00775, 0);
    });

    it('should derive KES/USDT correctly', () => {
      // KES/USDT = KES/USD × (1 / USDT/USD)
      // USDT/USD mid = 1.0001
      const legs = new Map<string, RateSnapshot>();
      legs.set('KES/USD', makeSnapshot('KES/USD', 0.00775));
      legs.set('USDT/USD', makeSnapshot('USDT/USD', 1.0001));

      const result = builder.derive('KES/USDT', legs);
      expect(result).not.toBeNull();
      expect(result!.mid).toBeCloseTo(0.00775 / 1.0001, 8);
    });

    it('should derive USDT/USDC correctly', () => {
      // USDT/USDC = USDT/USD × (1 / USDC/USD)
      const legs = new Map<string, RateSnapshot>();
      legs.set('USDT/USD', makeSnapshot('USDT/USD', 1.0001));
      legs.set('USDC/USD', makeSnapshot('USDC/USD', 0.9999));

      const result = builder.derive('USDT/USDC', legs);
      expect(result).not.toBeNull();
      expect(result!.mid).toBeCloseTo(1.0001 / 0.9999, 6);
    });

    it('should mark as stale if any leg is stale', () => {
      const legs = new Map<string, RateSnapshot>();
      legs.set('KES/USD', makeSnapshot('KES/USD', 0.00775, { stale: true }));
      legs.set('BTC/USD', makeSnapshot('BTC/USD', 87450));

      const result = builder.derive('KES/BTC', legs);
      expect(result).not.toBeNull();
      expect(result!.stale).toBe(true);
    });

    it('should return null if a leg is missing', () => {
      const legs = new Map<string, RateSnapshot>();
      legs.set('KES/USD', makeSnapshot('KES/USD', 0.00775));
      // Missing BTC/USD

      const result = builder.derive('KES/BTC', legs);
      expect(result).toBeNull();
    });

    it('should return null for a non-derived pair', () => {
      const result = builder.derive('BTC/USD', new Map());
      expect(result).toBeNull();
    });

    it('should return null if a leg mid is zero (cannot invert)', () => {
      const legs = new Map<string, RateSnapshot>();
      legs.set('KES/USD', makeSnapshot('KES/USD', 0.00775));
      legs.set('BTC/USD', makeSnapshot('BTC/USD', 0));

      const result = builder.derive('KES/BTC', legs);
      expect(result).toBeNull();
    });
  });
});
