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

/**
 * Open a persistent SSE connection to /rates/stream.
 * Calls `onData` whenever the server pushes a new snapshot.
 * Returns a cleanup function to close the connection.
 */
export function streamRates(onData: (rates: RateSnapshot[]) => void): () => void {
  const url = `${API_BASE}/rates/stream`;
  const source = new EventSource(url);

  source.onmessage = (event) => {
    try {
      const payload: RatesResponse = JSON.parse(event.data);
      if (payload.data?.length) {
        onData(payload.data);
      }
    } catch {
      // ignore malformed frames
    }
  };

  source.onerror = () => {
    // EventSource auto-reconnects; nothing to do
  };

  return () => source.close();
}
