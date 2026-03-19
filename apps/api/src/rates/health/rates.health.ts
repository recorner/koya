import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import type { RatesProvider } from '../providers/provider.interface';
import type { ProviderHealthState, RatesHealthResponse } from '../rates.types';
import { RatesCache } from '../cache/rates.cache';
import { DIRECT_PAIRS, STALENESS } from '../rates.constants';

/**
 * Health indicator for the rates module.
 *
 * Reports:
 *  - overall status (ok / degraded / down)
 *  - per-provider health
 *  - freshness of core direct pairs
 *  - cache connectivity
 */
@Injectable()
export class RatesHealth {
  private readonly logger = new Logger(RatesHealth.name);

  constructor(
    private readonly cache: CacheService,
    private readonly ratesCache: RatesCache,
  ) {}

  async check(providers: RatesProvider[]): Promise<RatesHealthResponse> {
    // 1. Cache health
    const cacheStatus = await this.cache.ping();

    // 2. Provider health (from cache, written by the service after each fetch)
    const providerStates: ProviderHealthState[] = [];
    for (const p of providers) {
      const state = await this.ratesCache.getProviderHealth(p.name);
      providerStates.push(
        state ?? {
          provider: p.name,
          available: false,
          lastSuccess: null,
          lastFailure: null,
          consecutiveFailures: 0,
          avgLatencyMs: 0,
        },
      );
    }

    // 3. Core pair freshness
    const corePairs: RatesHealthResponse['corePairs'] = [];
    for (const pair of DIRECT_PAIRS) {
      const snapshot = await this.ratesCache.getSpot(pair);
      if (snapshot) {
        const ageSeconds =
          (Date.now() - new Date(snapshot.calculatedAt).getTime()) / 1000;
        const isFiat = STALENESS.FIAT_PAIRS.includes(pair);
        const threshold = isFiat ? STALENESS.FIAT : STALENESS.CRYPTO;
        corePairs.push({
          pair,
          fresh: ageSeconds <= threshold,
          age: Math.round(ageSeconds),
        });
      } else {
        corePairs.push({ pair, fresh: false, age: null });
      }
    }

    // 4. Overall status
    const allProvidersDown = providerStates.every((p) => !p.available);
    const someProviderDown = providerStates.some((p) => !p.available);
    const cacheDown = !cacheStatus.ok;

    let status: 'ok' | 'degraded' | 'down' = 'ok';
    if (allProvidersDown || cacheDown) {
      status = 'down';
    } else if (someProviderDown) {
      status = 'degraded';
    }

    return {
      status,
      providers: providerStates,
      corePairs,
      cacheStatus: { ok: cacheStatus.ok, latencyMs: cacheStatus.latencyMs },
      timestamp: new Date().toISOString(),
    };
  }
}
