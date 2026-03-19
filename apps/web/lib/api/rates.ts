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

/** Fetch all live rates from the backend. */
export async function fetchRates(): Promise<RateSnapshot[]> {
  const res = await fetch(`${API_BASE}/rates?fresh=true`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const body: RatesResponse = await res.json();
  return body.data ?? [];
}
