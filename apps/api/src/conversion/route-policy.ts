/**
 * Route policy — defines supported conversion routes and their constraints.
 * Currently only KES → BTC is enabled.
 */

export interface RoutePolicy {
  key: string;
  sourceAsset: string;
  targetAsset: string;
  payinMethod: string;
  payoutMethod: string;
  minSourceMinor: bigint;
  maxSourceMinor: bigint;
  feePercent: string;
  enabled: boolean;
}

const ROUTE_POLICIES: RoutePolicy[] = [
  {
    key: 'KES_BTC_GUEST',
    sourceAsset: 'KES',
    targetAsset: 'BTC',
    payinMethod: 'MPESA_STK',
    payoutMethod: 'BTC_ADDRESS',
    minSourceMinor: BigInt(10_000),        // 100 KES
    maxSourceMinor: BigInt(10_000_000_000), // 100,000 KES
    feePercent: '1.5',
    enabled: true,
  },
];

export function getRoutePolicy(
  sourceAsset: string,
  targetAsset: string,
): RoutePolicy | null {
  return (
    ROUTE_POLICIES.find(
      (r) =>
        r.sourceAsset === sourceAsset &&
        r.targetAsset === targetAsset &&
        r.enabled,
    ) ?? null
  );
}

/** Guest limits (in KES minor units) */
export const GUEST_LIMITS = {
  dailyMinor: BigInt(10_000_000_000),   // 100,000 KES
  monthlyMinor: BigInt(30_000_000_000), // 300,000 KES
};

/** Quote TTL in seconds */
export const QUOTE_TTL_SECONDS = 30;
