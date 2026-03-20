'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { TICKER_INSTRUMENTS, type TickerInstrument } from '@/components/marketing/asset-metadata';
import { subscribeRates, fetchRates, type RateSnapshot } from '@/lib/api/rates';

/**
 * All hooks share a single SSE EventSource via subscribeRates().
 */

type RateMap = Record<string, Record<string, number>>;

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
 * React hook: live-updating rate map via shared SSE singleton.
 */
export function useRealtimeRates() {
  const [rates, setRates] = useState<RateMap>({});

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      fetchRates().then((s) => { if (s.length) setRates(snapshotsToRateMap(s)); });
      return;
    }
    return subscribeRates((snapshots) => {
      setRates(snapshotsToRateMap(snapshots));
    });
  }, []);

  return rates;
}

/**
 * Callback-based ticker hook for the market ribbon.
 * Shared SSE, zero React re-renders — caller patches DOM directly.
 */
export function useTickerUpdates(onUpdate: (tickers: TickerInstrument[]) => void) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;
  const baselineRef = useRef<RateMap | null>(null);

  useEffect(() => {
    const handle = (snapshots: RateSnapshot[]) => {
      const live = snapshotsToRateMap(snapshots);
      if (!baselineRef.current) baselineRef.current = live;
      const baseline = baselineRef.current;

      const updated = TICKER_INSTRUMENTS.map((t) => {
        const liveRate = live[t.baseSymbol]?.[t.quoteSymbol];
        const baseRate = baseline[t.baseSymbol]?.[t.quoteSymbol];
        if (liveRate == null || baseRate == null) return t;
        const { change, positive } = computeChange(liveRate, baseRate);
        return { ...t, price: formatTickerPrice(liveRate, t.pair), change, positive };
      });

      callbackRef.current(updated);
    };

    if (typeof EventSource === 'undefined') {
      fetchRates().then((s) => { if (s.length) handle(s); });
      return;
    }
    return subscribeRates(handle);
  }, []);
}

/**
 * Get a single live rate between two assets (shared SSE).
 */
export function useLiveRate(source: string, dest: string) {
  const rates = useRealtimeRates();
  return useMemo(() => rates[source]?.[dest] ?? 0, [rates, source, dest]);
}
