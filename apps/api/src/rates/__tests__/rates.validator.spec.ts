import { Logger } from '@nestjs/common';
import { RatesValidator } from '../aggregation/rates.validator';

// Suppress expected WARN log noise during unit tests
beforeAll(() => Logger.overrideLogger(false));
import type { NormalizedRate } from '../rates.types';

function makeRate(overrides: Partial<NormalizedRate> = {}): NormalizedRate {
  return {
    pair: 'BTC/USD',
    base: 'BTC',
    quote: 'USD',
    bid: 87400,
    ask: 87500,
    mid: 87450,
    source: 'test',
    sourceTimestamp: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    latencyMs: 50,
    confidence: 0.9,
    ...overrides,
  };
}

describe('RatesValidator', () => {
  let validator: RatesValidator;

  beforeEach(() => {
    validator = new RatesValidator();
  });

  // ── isValid ─────────────────────────────────────────────────

  describe('isValid', () => {
    it('should accept a valid rate', () => {
      expect(validator.isValid(makeRate())).toBe(true);
    });

    it('should reject zero mid', () => {
      expect(validator.isValid(makeRate({ mid: 0 }))).toBe(false);
    });

    it('should reject negative mid', () => {
      expect(validator.isValid(makeRate({ mid: -100 }))).toBe(false);
    });

    it('should reject NaN mid', () => {
      expect(validator.isValid(makeRate({ mid: NaN }))).toBe(false);
    });

    it('should reject Infinity mid', () => {
      expect(validator.isValid(makeRate({ mid: Infinity }))).toBe(false);
    });

    it('should reject negative bid', () => {
      expect(validator.isValid(makeRate({ bid: -1 }))).toBe(false);
    });

    it('should reject negative ask', () => {
      expect(validator.isValid(makeRate({ ask: -1 }))).toBe(false);
    });

    it('should reject bid > ask', () => {
      expect(validator.isValid(makeRate({ bid: 100, ask: 50 }))).toBe(false);
    });

    it('should accept null bid/ask', () => {
      expect(validator.isValid(makeRate({ bid: null, ask: null }))).toBe(true);
    });
  });

  // ── isStale ─────────────────────────────────────────────────

  describe('isStale', () => {
    it('should not be stale for a fresh crypto rate', () => {
      expect(validator.isStale(makeRate())).toBe(false);
    });

    it('should be stale for an old crypto rate (>10s)', () => {
      const old = new Date(Date.now() - 15000).toISOString();
      expect(validator.isStale(makeRate({ receivedAt: old }))).toBe(true);
    });

    it('should not be stale for a fresh FX rate', () => {
      const rate = makeRate({ pair: 'KES/USD', receivedAt: new Date().toISOString() });
      expect(validator.isStale(rate)).toBe(false);
    });

    it('should be stale for an old FX rate (>5min)', () => {
      const old = new Date(Date.now() - 310000).toISOString();
      const rate = makeRate({ pair: 'KES/USD', receivedAt: old });
      expect(validator.isStale(rate)).toBe(true);
    });
  });

  // ── checkDivergence ─────────────────────────────────────────

  describe('checkDivergence', () => {
    it('should pass for a single rate', () => {
      const result = validator.checkDivergence([makeRate()]);
      expect(result.ok).toBe(true);
      expect(result.maxDivergence).toBe(0);
    });

    it('should pass for rates within tolerance', () => {
      const r1 = makeRate({ mid: 87450 });
      const r2 = makeRate({ mid: 87500 }); // ~0.057% divergence
      expect(validator.checkDivergence([r1, r2]).ok).toBe(true);
    });

    it('should fail for rates beyond 2% tolerance', () => {
      const r1 = makeRate({ mid: 87000 });
      const r2 = makeRate({ mid: 90000 }); // ~3.4% divergence
      const result = validator.checkDivergence([r1, r2]);
      expect(result.ok).toBe(false);
      expect(result.maxDivergence).toBeGreaterThan(0.02);
    });

    it('should pass for empty array', () => {
      expect(validator.checkDivergence([]).ok).toBe(true);
    });
  });

  // ── isSnapshotStale ─────────────────────────────────────────

  describe('isSnapshotStale', () => {
    it('should not be stale for fresh snapshot', () => {
      expect(validator.isSnapshotStale('BTC/USD', new Date().toISOString())).toBe(false);
    });

    it('should be stale for old crypto snapshot', () => {
      const old = new Date(Date.now() - 15000).toISOString();
      expect(validator.isSnapshotStale('BTC/USD', old)).toBe(true);
    });
  });
});
