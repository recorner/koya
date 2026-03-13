'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { MOCK_RATES, TICKER_INSTRUMENTS, type TickerInstrument } from '@/components/marketing/asset-metadata';

/**
 * Simulated real-time rate feed.
 * Fluctuates around MOCK_RATES every `intervalMs` with ±spread%.
 *
 * In production, replace the setInterval with a WebSocket connection
 * to the rate-provider service — the consumer API stays identical.
 */

type RateMap = Record<string, Record<string, number>>;

const DEFAULT_SPREAD = 0.002; // ±0.2% jitter each tick

function jitter(base: number, spread: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * spread;
  return base * factor;
}

function generateLiveRates(spread = DEFAULT_SPREAD): RateMap {
  const live: RateMap = {};
  for (const [src, dests] of Object.entries(MOCK_RATES)) {
    live[src] = {};
    for (const [dst, rate] of Object.entries(dests)) {
      live[src][dst] = jitter(rate, spread);
    }
  }
  return live;
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
 * React hook: provides live-updating rate map.
 * @param intervalMs - tick interval in ms (default 2000)
 */
export function useRealtimeRates(intervalMs = 2000) {
  const [rates, setRates] = useState<RateMap>(() => generateLiveRates());

  useEffect(() => {
    const id = setInterval(() => {
      setRates(generateLiveRates());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return rates;
}

/**
 * React hook: provides live-updating ticker instruments for the market ribbon.
 */
export function useRealtimeTickers(intervalMs = 2000) {
  const [tickers, setTickers] = useState<TickerInstrument[]>(TICKER_INSTRUMENTS);
  const ratesRef = useRef<RateMap>(MOCK_RATES);

  useEffect(() => {
    const id = setInterval(() => {
      const live = generateLiveRates();
      ratesRef.current = live;

      const updated = TICKER_INSTRUMENTS.map((t) => {
        const liveRate = live[t.baseSymbol]?.[t.quoteSymbol];
        const baseRate = MOCK_RATES[t.baseSymbol]?.[t.quoteSymbol];
        if (liveRate == null || baseRate == null) return t;

        const { change, positive } = computeChange(liveRate, baseRate);
        return {
          ...t,
          price: formatTickerPrice(liveRate, t.pair),
          change,
          positive,
        };
      });

      setTickers(updated);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tickers;
}

/**
 * Get a single live rate between two assets.
 */
export function useLiveRate(source: string, dest: string, intervalMs = 2000) {
  const rates = useRealtimeRates(intervalMs);
  return useMemo(() => rates[source]?.[dest] ?? 0, [rates, source, dest]);
}
