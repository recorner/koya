const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.koyabank.com/api/v1';

export interface RateSnapshot {
  pair: string;
  mid: number;
  bid: number;
  ask: number;
  sourceCount: number;
  sources: string[];
  calculatedAt: string;
  stale: boolean;
  derived: boolean;
}

interface RatesResponse {
  success: boolean;
  data: RateSnapshot[];
  count: number;
  timestamp: string;
}

/** Fetch all live rates from the backend (one-shot REST fallback). */
export async function fetchRates(): Promise<RateSnapshot[]> {
  try {
    const res = await fetch(`${API_BASE}/rates?fresh=true`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return [];
    const body: RatesResponse = await res.json();
    return body.data ?? [];
  } catch {
    return [];
  }
}

/* ─── Server-side ribbon rate pre-fetch ─────────────────────────
   Fetches rates at render time so prices appear on first paint.
   Returns formatted ticker data ready for MarketRibbon props.
   ──────────────────────────────────────────────────────────────── */

import { TICKER_INSTRUMENTS } from '@/components/marketing/asset-metadata';

export interface RibbonRate {
  pair: string;
  price: string;
  change: string;
  positive: boolean;
}

function formatTickerPriceServer(value: number, pair: string): string {
  if (pair.includes('BTC / KES')) return Math.round(value).toLocaleString('en-US');
  if (pair.endsWith('USD'))
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value < 0.01) return value.toFixed(5);
  if (value < 1) return value.toFixed(4);
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Pre-fetch rates for the ribbon. Call from server components. */
export async function fetchRibbonRates(): Promise<RibbonRate[]> {
  const snapshots = await fetchRates();
  if (!snapshots.length) return [];

  const rateMap: Record<string, Record<string, number>> = {};
  for (const s of snapshots) {
    const [base, quote] = s.pair.split('/');
    if (!base || !quote) continue;
    (rateMap[base] ??= {})[quote] = s.mid;
    if (s.mid !== 0) (rateMap[quote] ??= {})[base] ??= 1 / s.mid;
  }

  return TICKER_INSTRUMENTS.map((t) => {
    const rate = rateMap[t.baseSymbol]?.[t.quoteSymbol];
    if (rate == null) return { pair: t.pair, price: '', change: '', positive: true };
    return {
      pair: t.pair,
      price: formatTickerPriceServer(rate, t.pair),
      change: '+0.00%',
      positive: true,
    };
  });
}

/* ─── Singleton SSE stream ─────────────────────────────────────────
   One EventSource shared across all hooks. Ref-counted so it stays
   open as long as at least one subscriber exists. Reconnects on error
   with exponential backoff (1s → 2s → 4s … max 30s).
   ──────────────────────────────────────────────────────────────── */

type Listener = (rates: RateSnapshot[]) => void;

const listeners = new Set<Listener>();
let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = 1000;
const MAX_BACKOFF = 30_000;

function resetBackoff() {
  backoff = 1000;
}

function destroyStream() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function ensureStream() {
  if (eventSource) return;
  if (reconnectTimer) return; // reconnect already scheduled

  const url = `${API_BASE}/rates/stream`;
  const es = new EventSource(url);
  eventSource = es;

  es.onopen = () => {
    resetBackoff();
  };

  es.onmessage = (event) => {
    try {
      const payload: RatesResponse = JSON.parse(event.data);
      if (payload.data?.length) {
        for (const cb of listeners) cb(payload.data);
      }
    } catch {
      // ignore malformed frames
    }
  };

  es.onerror = () => {
    // Connection lost — tear down and schedule reconnect
    es.close();
    if (eventSource === es) eventSource = null;

    // Only reconnect if there are still listeners
    if (listeners.size > 0 && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        ensureStream();
      }, backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF);
    }
  };
}

function closeStreamIfIdle() {
  if (listeners.size === 0) {
    destroyStream();
  }
}

/** Subscribe to the shared SSE rate stream. Returns unsubscribe fn. */
export function subscribeRates(cb: Listener): () => void {
  listeners.add(cb);
  ensureStream();
  return () => {
    listeners.delete(cb);
    closeStreamIfIdle();
  };
}
