'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { TICKER_INSTRUMENTS, type TickerInstrument } from '@/components/marketing/asset-metadata';
import { streamRates, fetchRates, type RateSnapshot } from '@/lib/api/rates';

/**
 * Realtime rate feed powered by SSE from /api/v1/rates/stream.
 * Falls back to a single REST fetch if SSE isn't available (e.g. SSR).
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
  // All USD-quoted pairs: 2 decimal places
  if (pair.endsWith('USD')) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value < 0.01) return value.toFixed(5);
  if (value < 1) return value.toFixed(4);
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
 * React hook: provides live-updating rate map via SSE.
 * Falls back to a one-shot REST fetch for initial paint.
 */
export function useRealtimeRates() {
  const [rates, setRates] = useState<RateMap>({});

  useEffect(() => {
    // SSE not available during SSR — one-shot fetch as seed
    if (typeof EventSource === 'undefined') {
      fetchRates().then((s) => { if (s.length) setRates(snapshotsToRateMap(s)); });
      return;
    }

    // Open persistent SSE connection
    const close = streamRates((snapshots) => {
      setRates(snapshotsToRateMap(snapshots));
    });

    return close;
  }, []);

  return rates;
}

/**
 * Callback-based ticker hook for the market ribbon.
 * Uses SSE stream — pushes updates via callback ref (zero React re-renders).
 * The caller patches the DOM directly.
 */
export function useTickerUpdates(onUpdate: (tickers: TickerInstrument[]) => void) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  const baselineRef = useRef<RateMap | null>(null);

  useEffect(() => {
    const handleSnapshots = (snapshots: RateSnapshot[]) => {
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

    // SSR fallback
    if (typeof EventSource === 'undefined') {
      fetchRates().then((s) => { if (s.length) handleSnapshots(s); });
      return;
    }

    return streamRates(handleSnapshots);
  }, []);
}

/**
 * Get a single live rate between two assets (SSE-backed).
 */
export function useLiveRate(source: string, dest: string) {
  const rates = useRealtimeRates();
  return useMemo(() => rates[source]?.[dest] ?? 0, [rates, source, dest]);
}
