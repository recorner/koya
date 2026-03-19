import { Injectable, Logger } from '@nestjs/common';
import type { NormalizedRate } from '../rates.types';
import { stalenessThreshold, MAX_DIVERGENCE } from '../rates.constants';

/**
 * Validates individual rate entries and detects divergence across providers.
 */
@Injectable()
export class RatesValidator {
  private readonly logger = new Logger(RatesValidator.name);

  /**
   * Check if a NormalizedRate has valid numeric values.
   */
  isValid(rate: NormalizedRate): boolean {
    if (!Number.isFinite(rate.mid) || rate.mid <= 0) {
      this.logger.warn(`Invalid mid price for ${rate.pair} from ${rate.source}: ${rate.mid}`);
      return false;
    }
    if (rate.bid !== null && (!Number.isFinite(rate.bid) || rate.bid <= 0)) {
      this.logger.warn(`Invalid bid for ${rate.pair} from ${rate.source}: ${rate.bid}`);
      return false;
    }
    if (rate.ask !== null && (!Number.isFinite(rate.ask) || rate.ask <= 0)) {
      this.logger.warn(`Invalid ask for ${rate.pair} from ${rate.source}: ${rate.ask}`);
      return false;
    }
    if (rate.bid !== null && rate.ask !== null && rate.bid > rate.ask) {
      this.logger.warn(`Bid > Ask for ${rate.pair} from ${rate.source}: ${rate.bid} > ${rate.ask}`);
      return false;
    }
    return true;
  }

  /**
   * Check if a rate is stale based on its receivedAt timestamp.
   */
  isStale(rate: NormalizedRate): boolean {
    const ageSeconds = (Date.now() - new Date(rate.receivedAt).getTime()) / 1000;
    const threshold = stalenessThreshold(rate.pair);
    return ageSeconds > threshold;
  }

  /**
   * Check if multiple rates for the same pair diverge beyond tolerance.
   * Returns true if divergence is acceptable (within tolerance).
   */
  checkDivergence(rates: NormalizedRate[]): {
    ok: boolean;
    maxDivergence: number;
  } {
    if (rates.length < 2) return { ok: true, maxDivergence: 0 };

    let maxDiv = 0;
    for (let i = 0; i < rates.length; i++) {
      for (let j = i + 1; j < rates.length; j++) {
        const rateA = rates[i]!;
        const rateB = rates[j]!;
        const avg = (rateA.mid + rateB.mid) / 2;
        if (avg === 0) continue;
        const divergence = Math.abs(rateA.mid - rateB.mid) / avg;
        maxDiv = Math.max(maxDiv, divergence);
      }
    }

    if (maxDiv > MAX_DIVERGENCE) {
      this.logger.warn(
        `Rate divergence ${(maxDiv * 100).toFixed(2)}% exceeds threshold ${(MAX_DIVERGENCE * 100).toFixed(2)}% for ${rates[0]!.pair}`,
      );
    }

    return { ok: maxDiv <= MAX_DIVERGENCE, maxDivergence: maxDiv };
  }

  /**
   * Check staleness of a cached snapshot by its calculatedAt timestamp.
   */
  isSnapshotStale(pair: string, calculatedAt: string): boolean {
    const ageSeconds = (Date.now() - new Date(calculatedAt).getTime()) / 1000;
    return ageSeconds > stalenessThreshold(pair);
  }
}
