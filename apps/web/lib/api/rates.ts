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
  const res = await fetch(`${API_BASE}/rates?fresh=true`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const body: RatesResponse = await res.json();
  return body.data ?? [];
}

/* ─── Singleton SSE stream ─────────────────────────────────────────
   One EventSource shared across all hooks. Ref-counted so it stays
   open as long as at least one subscriber exists.
   ──────────────────────────────────────────────────────────────── */

type Listener = (rates: RateSnapshot[]) => void;

const listeners = new Set<Listener>();
let eventSource: EventSource | null = null;

function ensureStream() {
  if (eventSource) return;
  const url = `${API_BASE}/rates/stream`;
  eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const payload: RatesResponse = JSON.parse(event.data);
      if (payload.data?.length) {
        for (const cb of listeners) cb(payload.data);
      }
    } catch {
      // ignore malformed frames
    }
  };
}

function closeStreamIfIdle() {
  if (listeners.size === 0 && eventSource) {
    eventSource.close();
    eventSource = null;
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
