import { getRoutePolicy, GUEST_LIMITS, QUOTE_TTL_SECONDS } from './route-policy';

describe('Route Policy', () => {
  it('returns KES → BTC route', () => {
    const route = getRoutePolicy('KES', 'BTC');
    expect(route).not.toBeNull();
    expect(route?.key).toBe('KES_BTC_GUEST');
    expect(route?.payinMethod).toBe('MPESA_STK');
    expect(route?.payoutMethod).toBe('BTC_ADDRESS');
    expect(route?.enabled).toBe(true);
  });

  it('returns null for unsupported routes', () => {
    expect(getRoutePolicy('USD', 'BTC')).toBeNull();
    expect(getRoutePolicy('BTC', 'KES')).toBeNull();
    expect(getRoutePolicy('ETH', 'BTC')).toBeNull();
  });

  it('has 30s quote TTL', () => {
    expect(QUOTE_TTL_SECONDS).toBe(30);
  });

  it('has correct guest limits', () => {
    expect(GUEST_LIMITS.dailyMinor).toBe(BigInt(10_000_000_000));   // 100K KES
    expect(GUEST_LIMITS.monthlyMinor).toBe(BigInt(30_000_000_000)); // 300K KES
  });
});
