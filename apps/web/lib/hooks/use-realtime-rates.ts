'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TICKER_INSTRUMENTS, type TickerInstrument } from '@/components/marketing/asset-metadata';
import { fetchRates, type RateSnapshot } from '@/lib/api/rates';

/**
 * Realtime rate feed powered by the backend /api/v1/rates endpoint.
 * Polls every `intervalMs` (default 2 s). Shows empty/zero state
 * until the first successful API response.
 */

type RateMap = Record<string, Record<string, number>>;

/** Convert the flat array from the API into the nested RateMap the UI expects. */
function snapshotsToRateMap(snapshots: RateSnapshot[]): RateMap {
  const map: RateMap = {};
  for (const s of snapshots) {
    const [base, quote] = s.pair.split('/');
    if (!base || !quote) continue;
    (map[base] ??= {})[quote] = s.mid;
  }
  return map;
}

function formatTickerPrice(value: number, pair: string): string {
  if (pair.includes('BTC / KES')) return Math.round(value).toLocaleString('en-US');
  if (pair.includes('BTC / USD')) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value < 0.01) return value.toFixed(5);
  if (value < 1) return value.toFixed(4);
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function computeChange(current: number, base: number): { change: string; positive: boolean } {
  const pct = ((current - base) / base) * 100;
  const positive = pct >= 0;
  return {
    change: `${positive ? '+' : ''}${pct.toFixed(2)}%`,
    positive,
  };
}

/**
 * React hook: provides live-updating rate map from the backend.
 * @param intervalMs - poll interval in ms (default 2000)
 */
export function useRealtimeRates(intervalMs = 2000) {
  const [rates, setRates] = useState<RateMap>({});

  const refresh = useCallback(async () => {
    const snapshots = await fetchRates();
    if (snapshots.length > 0) {
      setRates(snapshotsToRateMap(snapshots));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, refresh]);

  return rates;
}

/**
 * Callback-based ticker hook for the market ribbon.
 * Pushes updates via a callback ref — zero React re-renders.
 * The caller patches the DOM directly.
 */
export function useTickerUpdates(onUpdate: (tickers: TickerInstrument[]) => void, intervalMs = 2000) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  const baselineRef = useRef<RateMap | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const snapshots = await fetchRates();
      if (!active || snapshots.length === 0) return;

      const live = snapshotsToRateMap(snapshots);
      if (!baselineRef.current) baselineRef.current = live;
      const baseline = baselineRef.current;

      const updated = TICKER_INSTRUMENTS.map((t) => {
        const liveRate = live[t.baseSymbol]?.[t.quoteSymbol];
        const baseRate = baseline[t.baseSymbol]?.[t.quoteSymbol];
        if (liveRate == null || baseRate == null) return t;

        const { change, positive } = computeChange(liveRate, baseRate);
        return {
          ...t,
          price: formatTickerPrice(liveRate, t.pair),
          change,
          positive,
        };
      });

      callbackRef.current(updated);
    };

    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => { active = false; clearInterval(id); };
  }, [intervalMs]);
}

/**
 * Get a single live rate between two assets.
 */
export function useLiveRate(source: string, dest: string, intervalMs = 2000) {
  const rates = useRealtimeRates(intervalMs);
  return useMemo(() => rates[source]?.[dest] ?? 0, [rates, source, dest]);
}
