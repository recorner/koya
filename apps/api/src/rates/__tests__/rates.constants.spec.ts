import {
  parsePair,
  isDirectPair,
  isDerivedPair,
  stalenessThreshold,
  DIRECT_PAIRS,
  DERIVED_PAIRS,
  ALL_PAIRS,
  DERIVATION_ROUTES,
  STALENESS,
} from '../rates.constants';

describe('rates.constants', () => {
  describe('parsePair', () => {
    it('should split BTC/USD into base and quote', () => {
      expect(parsePair('BTC/USD')).toEqual({ base: 'BTC', quote: 'USD' });
    });

    it('should split KES/BTC into base and quote', () => {
      expect(parsePair('KES/BTC')).toEqual({ base: 'KES', quote: 'BTC' });
    });
  });

  describe('isDirectPair', () => {
    it('should return true for BTC/USD', () => {
      expect(isDirectPair('BTC/USD')).toBe(true);
    });

    it('should return true for KES/USD', () => {
      expect(isDirectPair('KES/USD')).toBe(true);
    });

    it('should return false for KES/BTC (derived)', () => {
      expect(isDirectPair('KES/BTC')).toBe(false);
    });
  });

  describe('isDerivedPair', () => {
    it('should return true for KES/BTC', () => {
      expect(isDerivedPair('KES/BTC')).toBe(true);
    });

    it('should return true for BTC/KES', () => {
      expect(isDerivedPair('BTC/KES')).toBe(true);
    });

    it('should return false for BTC/USD (direct)', () => {
      expect(isDerivedPair('BTC/USD')).toBe(false);
    });
  });

  describe('stalenessThreshold', () => {
    it('should return crypto threshold for BTC/USD', () => {
      expect(stalenessThreshold('BTC/USD')).toBe(STALENESS.CRYPTO);
    });

    it('should return fiat threshold for KES/USD', () => {
      expect(stalenessThreshold('KES/USD')).toBe(STALENESS.FIAT);
    });
  });

  describe('ALL_PAIRS', () => {
    it('should include all direct and derived pairs', () => {
      expect(ALL_PAIRS.length).toBe(DIRECT_PAIRS.length + DERIVED_PAIRS.length);
    });

    it('should have derivation routes for every derived pair', () => {
      for (const pair of DERIVED_PAIRS) {
        expect(DERIVATION_ROUTES[pair]).toBeDefined();
      }
    });
  });
});
