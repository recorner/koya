import { Injectable, Logger } from '@nestjs/common';
import type { RateSnapshot } from '../rates.types';
import { DERIVATION_ROUTES, isDerivedPair } from '../rates.constants';

/**
 * Computes derived pair rates from core direct-market snapshots.
 *
 * Route notation:
 *   "KES/USD"   → use the mid price directly
 *   "!BTC/USD"  → use the inverse (1 / mid)
 */
@Injectable()
export class RatesRouteBuilder {
  private readonly logger = new Logger(RatesRouteBuilder.name);

  /**
   * Get the leg pairs needed to derive a given pair.
   * Returns null if the pair is not derived.
   */
  getRoute(pair: string): string[] | null {
    return DERIVATION_ROUTES[pair] ?? null;
  }

  /**
   * Get the raw (non-inverted) pair names needed to derive a pair.
   * Strips the "!" inversion prefix.
   */
  getRequiredDirectPairs(pair: string): string[] {
    const route = this.getRoute(pair);
    if (!route) return [];
    return route.map((leg) => leg.replace(/^!/, ''));
  }

  /**
   * Compute a derived rate snapshot from its leg snapshots.
   *
   * @param pair The derived pair to compute (e.g. "KES/BTC")
   * @param legSnapshots Map of direct pair → RateSnapshot for each leg
   * @returns The derived RateSnapshot, or null if a required leg is missing/stale
   */
  derive(
    pair: string,
    legSnapshots: Map<string, RateSnapshot>,
  ): RateSnapshot | null {
    if (!isDerivedPair(pair)) {
      this.logger.warn(`${pair} is not a derived pair`);
      return null;
    }

    const route = this.getRoute(pair);
    if (!route) return null;

    let mid = 1;
    let anyStale = false;
    const sources: string[] = [];
    const routeLabels: string[] = [];
    let bidProduct: number | null = 1;
    let askProduct: number | null = 1;

    for (const leg of route) {
      const inverted = leg.startsWith('!');
      const directPair = leg.replace(/^!/, '');
      const snapshot = legSnapshots.get(directPair);

      if (!snapshot) {
        this.logger.warn(`Missing leg ${directPair} for derived pair ${pair}`);
        return null;
      }

      if (snapshot.stale) anyStale = true;

      sources.push(...snapshot.sources);
      routeLabels.push(leg);

      if (inverted) {
        if (snapshot.mid === 0) {
          this.logger.warn(`Zero mid for ${directPair}, cannot invert`);
          return null;
        }
        mid *= 1 / snapshot.mid;
        // For inverted pairs, bid/ask swap and invert
        if (bidProduct !== null && snapshot.ask !== null && snapshot.ask !== 0) {
          bidProduct *= 1 / snapshot.ask;
        } else {
          bidProduct = null;
        }
        if (askProduct !== null && snapshot.bid !== null && snapshot.bid !== 0) {
          askProduct *= 1 / snapshot.bid;
        } else {
          askProduct = null;
        }
      } else {
        mid *= snapshot.mid;
        if (bidProduct !== null && snapshot.bid !== null) {
          bidProduct *= snapshot.bid;
        } else {
          bidProduct = null;
        }
        if (askProduct !== null && snapshot.ask !== null) {
          askProduct *= snapshot.ask;
        } else {
          askProduct = null;
        }
      }
    }

    const uniqueSources = [...new Set(sources)];

    return {
      pair,
      mid,
      bid: bidProduct,
      ask: askProduct,
      sourceCount: uniqueSources.length,
      sources: uniqueSources,
      calculatedAt: new Date().toISOString(),
      stale: anyStale,
      derived: true,
      route: routeLabels,
    };
  }
}
