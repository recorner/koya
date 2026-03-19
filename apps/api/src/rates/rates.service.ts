import { Injectable, Logger } from '@nestjs/common';
import type { RatesProvider } from './providers/provider.interface';
import type { RateSnapshot, ProviderHealthState } from './rates.types';
import { RatesAggregator } from './aggregation/rates.aggregator';
import { RatesRouteBuilder } from './aggregation/rates.route-builder';
import { RatesValidator } from './aggregation/rates.validator';
import { RatesCache } from './cache/rates.cache';
import { RatesHealth } from './health/rates.health';
import {
  ALL_PAIRS,
  isDirectPair,
  isDerivedPair,
  DIRECT_PAIRS,
} from './rates.constants';

/**
 * Main entrypoint for rate consumers.
 *
 * Resolves any supported pair (direct or derived), uses cached values
 * when fresh, falls back to last-good on failure, and keeps provider
 * health state current.
 */
@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(
    private readonly providers: RatesProvider[],
    private readonly aggregator: RatesAggregator,
    private readonly routeBuilder: RatesRouteBuilder,
    private readonly validator: RatesValidator,
    private readonly ratesCache: RatesCache,
    private readonly health: RatesHealth,
  ) {}

  // ── Public API ────────────────────────────────────────────────

  /**
   * Get a single pair snapshot. Checks cache, refreshes if needed,
   * derives if the pair is computed.
   */
  async getRate(pair: string): Promise<RateSnapshot | null> {
    if (isDirectPair(pair)) {
      return this.getDirectRate(pair);
    }
    if (isDerivedPair(pair)) {
      return this.getDerivedRate(pair);
    }
    this.logger.warn(`Unsupported pair: ${pair}`);
    return null;
  }

  /**
   * Get all supported pair snapshots.
   */
  async getAllRates(): Promise<RateSnapshot[]> {
    const results = await Promise.all(
      (ALL_PAIRS as readonly string[]).map((pair) => this.getRate(pair)),
    );
    return results.filter((r): r is RateSnapshot => r !== null);
  }

  /**
   * Get rates health report.
   */
  async getHealthReport() {
    return this.health.check(this.providers);
  }

  // ── Direct pair resolution ────────────────────────────────────

  private async getDirectRate(pair: string): Promise<RateSnapshot | null> {
    // 1. Check cache
    const cached = await this.ratesCache.getSpot(pair);
    if (cached && !this.ratesCache.isSnapshotStale(pair, cached)) {
      return cached;
    }

    // 2. Fresh fetch from providers
    const snapshot = await this.aggregator.aggregate(pair, this.providers);

    if (snapshot) {
      // Cache the fresh result and update last-good
      await this.ratesCache.setSpot(pair, snapshot);
      await this.ratesCache.setLastGood(pair, snapshot);
      await this.updateProviderHealth(pair, true);
      return snapshot;
    }

    // 3. Fallback to last-good
    const lastGood = await this.ratesCache.getLastGood(pair);
    if (lastGood) {
      this.logger.warn(`Using last-good fallback for ${pair}`);
      return { ...lastGood, stale: true };
    }

    await this.updateProviderHealth(pair, false);
    this.logger.error(`No rate available for ${pair} — all sources failed`);
    return null;
  }

  // ── Derived pair resolution ───────────────────────────────────

  private async getDerivedRate(pair: string): Promise<RateSnapshot | null> {
    // 1. Check derived cache
    const cached = await this.ratesCache.getDerived(pair);
    if (cached && !this.ratesCache.isSnapshotStale(pair, cached)) {
      return cached;
    }

    // 2. Fetch required legs
    const requiredPairs = this.routeBuilder.getRequiredDirectPairs(pair);
    const legSnapshots = new Map<string, RateSnapshot>();

    for (const legPair of requiredPairs) {
      const leg = await this.getDirectRate(legPair);
      if (!leg) {
        this.logger.warn(`Cannot derive ${pair}: missing leg ${legPair}`);
        // Fallback to last-good derived
        return this.fallbackDerived(pair);
      }
      legSnapshots.set(legPair, leg);
    }

    // 3. Compute derived rate
    const snapshot = this.routeBuilder.derive(pair, legSnapshots);
    if (!snapshot) {
      return this.fallbackDerived(pair);
    }

    // Cache the derived result and update last-good
    await this.ratesCache.setDerived(pair, snapshot);
    await this.ratesCache.setLastGood(pair, snapshot);
    return snapshot;
  }

  private async fallbackDerived(pair: string): Promise<RateSnapshot | null> {
    const lastGood = await this.ratesCache.getLastGood(pair);
    if (lastGood) {
      this.logger.warn(`Using last-good fallback for derived ${pair}`);
      return { ...lastGood, stale: true };
    }
    this.logger.error(`No rate available for derived ${pair}`);
    return null;
  }

  // ── Provider health tracking ──────────────────────────────────

  private async updateProviderHealth(
    pair: string,
    success: boolean,
  ): Promise<void> {
    // Update health for each provider that supports this pair
    for (const provider of this.providers) {
      if (!provider.supportedPairs.includes(pair)) continue;

      const existing = await this.ratesCache.getProviderHealth(provider.name);
      const now = new Date().toISOString();

      const state: ProviderHealthState = existing ?? {
        provider: provider.name,
        available: true,
        lastSuccess: null,
        lastFailure: null,
        consecutiveFailures: 0,
        avgLatencyMs: 0,
      };

      if (success) {
        state.available = true;
        state.lastSuccess = now;
        state.consecutiveFailures = 0;
      } else {
        state.consecutiveFailures += 1;
        state.lastFailure = now;
        if (state.consecutiveFailures >= 3) {
          state.available = false;
        }
      }

      await this.ratesCache.setProviderHealth(state);
    }
  }
}
