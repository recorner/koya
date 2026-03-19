import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import {
  buildKey,
  CacheNamespace,
  DefaultTTL,
} from '../../cache/cache.constants';
import type { RateSnapshot, ProviderHealthState } from '../rates.types';
import { stalenessThreshold, STALENESS } from '../rates.constants';

/**
 * Rate-specific cache operations on top of the shared CacheService.
 *
 * Manages:
 *  - rates:spot:<pair>       — direct market rates (short TTL)
 *  - rates:derived:<pair>    — derived/computed rates
 *  - rates:lastgood:<pair>   — last known good rate (longer TTL)
 *  - provider_health:<name>  — provider health state
 */
@Injectable()
export class RatesCache {
  private readonly logger = new Logger(RatesCache.name);

  constructor(private readonly cache: CacheService) {}

  // ── Spot rates ────────────────────────────────────────────────

  async getSpot(pair: string): Promise<RateSnapshot | null> {
    const key = buildKey(CacheNamespace.RATES_SPOT, pair);
    return this.cache.getJSON<RateSnapshot>(key);
  }

  async setSpot(pair: string, snapshot: RateSnapshot): Promise<boolean> {
    const key = buildKey(CacheNamespace.RATES_SPOT, pair);
    const ttl = STALENESS.FIAT_PAIRS.includes(pair)
      ? DefaultTTL.FX_RATE
      : DefaultTTL.CRYPTO_SPOT;
    return this.cache.setJSON(key, snapshot, ttl);
  }

  // ── Derived rates ─────────────────────────────────────────────

  async getDerived(pair: string): Promise<RateSnapshot | null> {
    const key = buildKey(CacheNamespace.RATES_DERIVED, pair);
    return this.cache.getJSON<RateSnapshot>(key);
  }

  async setDerived(pair: string, snapshot: RateSnapshot): Promise<boolean> {
    const key = buildKey(CacheNamespace.RATES_DERIVED, pair);
    return this.cache.setJSON(key, snapshot, DefaultTTL.DERIVED_RATE);
  }

  // ── Last-good fallback ────────────────────────────────────────

  async getLastGood(pair: string): Promise<RateSnapshot | null> {
    const key = buildKey(CacheNamespace.RATES_LASTGOOD, pair);
    return this.cache.getJSON<RateSnapshot>(key);
  }

  /**
   * Persist a validated snapshot as the last-good fallback.
   * Uses a much longer TTL (10 minutes) to survive provider outages.
   */
  async setLastGood(pair: string, snapshot: RateSnapshot): Promise<boolean> {
    const key = buildKey(CacheNamespace.RATES_LASTGOOD, pair);
    return this.cache.setJSON(key, snapshot, 600);
  }

  // ── Provider health ───────────────────────────────────────────

  async getProviderHealth(provider: string): Promise<ProviderHealthState | null> {
    const key = buildKey(CacheNamespace.PROVIDER_HEALTH, provider);
    return this.cache.getJSON<ProviderHealthState>(key);
  }

  async setProviderHealth(state: ProviderHealthState): Promise<boolean> {
    const key = buildKey(CacheNamespace.PROVIDER_HEALTH, state.provider);
    return this.cache.setJSON(key, state, DefaultTTL.PROVIDER_HEALTH);
  }

  // ── Staleness check on cached snapshot ────────────────────────

  isSnapshotStale(pair: string, snapshot: RateSnapshot): boolean {
    const ageSeconds =
      (Date.now() - new Date(snapshot.calculatedAt).getTime()) / 1000;
    return ageSeconds > stalenessThreshold(pair);
  }
}
