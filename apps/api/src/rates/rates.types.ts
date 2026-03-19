/**
 * Normalized rate from a single provider.
 * Every provider adapter maps its response into this shape.
 */
export interface NormalizedRate {
  pair: string;
  base: string;
  quote: string;
  bid: number | null;
  ask: number | null;
  mid: number;
  source: string;
  sourceTimestamp: string;
  receivedAt: string;
  latencyMs: number;
  confidence: number;
}

/**
 * Aggregated/derived snapshot — the final rate exposed to consumers.
 */
export interface RateSnapshot {
  pair: string;
  mid: number;
  bid: number | null;
  ask: number | null;
  sourceCount: number;
  sources: string[];
  calculatedAt: string;
  stale: boolean;
  derived: boolean;
  route?: string[];
}

/**
 * Provider health tracking state.
 */
export interface ProviderHealthState {
  provider: string;
  available: boolean;
  lastSuccess: string | null;
  lastFailure: string | null;
  consecutiveFailures: number;
  avgLatencyMs: number;
}

/**
 * Result from a provider health check.
 */
export interface ProviderHealthCheck {
  provider: string;
  ok: boolean;
  latencyMs: number;
  checkedAt: string;
}

/**
 * Route definition for derived pairs.
 */
export interface DerivedRoute {
  pair: string;
  legs: string[];
  operation: 'multiply' | 'divide';
}

/**
 * Response shape for the rates health endpoint.
 */
export interface RatesHealthResponse {
  status: 'ok' | 'degraded' | 'down';
  providers: ProviderHealthState[];
  corePairs: { pair: string; fresh: boolean; age: number | null }[];
  cacheStatus: { ok: boolean; latencyMs: number };
  timestamp: string;
}
