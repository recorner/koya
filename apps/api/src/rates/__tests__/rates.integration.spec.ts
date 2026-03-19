import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from '../../cache/cache.service';
import { REDIS_CLIENT } from '../../cache/cache.constants';
import { RatesCache } from '../cache/rates.cache';
import { RatesValidator } from '../aggregation/rates.validator';
import { RatesAggregator } from '../aggregation/rates.aggregator';
import { RatesRouteBuilder } from '../aggregation/rates.route-builder';
import { RatesHealth } from '../health/rates.health';
import { RatesService } from '../rates.service';
import type { RatesProvider } from '../providers/provider.interface';
import type { NormalizedRate } from '../rates.types';

function makeRate(mid: number, source: string, pair: string): NormalizedRate {
  return {
    pair,
    base: pair.split('/')[0] ?? '',
    quote: pair.split('/')[1] ?? '',
    bid: mid * 0.999,
    ask: mid * 1.001,
    mid,
    source,
    sourceTimestamp: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    latencyMs: 10,
    confidence: 0.9,
  };
}

function mockProvider(name: string, pairs: string[], rates: Record<string, NormalizedRate>): RatesProvider {
  return {
    name,
    supportedPairs: pairs,
    getTicker: jest.fn(async (pair: string) => {
      const r = rates[pair];
      if (!r) throw new Error(`No rate for ${pair}`);
      return r;
    }),
    getMany: jest.fn(async () => []),
    getHealth: jest.fn(async () => ({ provider: name, ok: true, latencyMs: 5, checkedAt: new Date().toISOString() })),
  };
}

/**
 * Integration tests — require a running Redis instance.
 *
 * Run with: docker-compose up redis -d && pnpm nx test api --testPathPattern="rates.integration"
 */
describe('RatesService (Integration)', () => {
  // Suppress expected WARN/ERROR log noise during integration tests
  beforeAll(() => Logger.overrideLogger(false));

  let service: RatesService;
  let ratesCache: RatesCache;
  let redis: Redis;
  let module: TestingModule;

  const testProviders: RatesProvider[] = [
    mockProvider('kraken', ['BTC/USD', 'USDT/USD', 'USDC/USD'], {
      'BTC/USD': makeRate(87450, 'kraken', 'BTC/USD'),
      'USDT/USD': makeRate(1.0001, 'kraken', 'USDT/USD'),
      'USDC/USD': makeRate(0.9999, 'kraken', 'USDC/USD'),
    }),
    mockProvider('fx', ['KES/USD'], {
      'KES/USD': makeRate(0.00775, 'fx', 'KES/USD'),
    }),
  ];

  beforeAll(async () => {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    redis = new Redis({ host, port, db: 2, maxRetriesPerRequest: 1 });

    try {
      await redis.ping();
    } catch {
      console.warn('Redis not available — skipping integration tests');
      await redis.quit();
      return;
    }

    module = await Test.createTestingModule({
      providers: [
        { provide: REDIS_CLIENT, useValue: redis },
        CacheService,
        RatesCache,
        RatesValidator,
        RatesAggregator,
        RatesRouteBuilder,
        RatesHealth,
        {
          provide: RatesService,
          useFactory: (
            aggregator: RatesAggregator,
            routeBuilder: RatesRouteBuilder,
            validator: RatesValidator,
            cache: RatesCache,
            health: RatesHealth,
          ) => new RatesService(testProviders, aggregator, routeBuilder, validator, cache, health),
          inject: [RatesAggregator, RatesRouteBuilder, RatesValidator, RatesCache, RatesHealth],
        },
      ],
    })
      .setLogger({ log() {}, error() {}, warn() {}, debug() {}, verbose() {}, fatal() {} })
      .compile();

    service = module.get<RatesService>(RatesService);
    ratesCache = module.get<RatesCache>(RatesCache);
  });

  beforeEach(async () => {
    // Flush test DB before each test
    if (redis.status === 'ready') {
      await redis.flushdb();
    }
  });

  afterAll(async () => {
    if (redis.status === 'ready') {
      await redis.flushdb();
    }
    await redis.quit();
  });

  it('should fetch and cache a direct rate in Redis', async () => {
    if (redis.status !== 'ready') return;

    const result = await service.getRate('BTC/USD');
    expect(result).not.toBeNull();
    expect(result!.pair).toBe('BTC/USD');
    expect(result!.mid).toBe(87450);

    // Verify it was cached
    const cached = await ratesCache.getSpot('BTC/USD');
    expect(cached).not.toBeNull();
    expect(cached!.mid).toBe(87450);
  });

  it('should serve from cache on second read', async () => {
    if (redis.status !== 'ready') return;

    // First call — fetches from provider
    await service.getRate('BTC/USD');

    // Reset mock call count
    const kraken = testProviders[0]!;
    (kraken.getTicker as jest.Mock).mockClear();

    // Second call — should serve from cache
    const result = await service.getRate('BTC/USD');
    expect(result).not.toBeNull();
    expect(kraken.getTicker).not.toHaveBeenCalled();
  });

  it('should compute and cache a derived rate', async () => {
    if (redis.status !== 'ready') return;

    const result = await service.getRate('KES/BTC');
    expect(result).not.toBeNull();
    expect(result!.derived).toBe(true);
    expect(result!.mid).toBeCloseTo(0.00775 / 87450, 12);

    // Verify derived cache
    const cached = await ratesCache.getDerived('KES/BTC');
    expect(cached).not.toBeNull();
  });

  it('should persist last-good for fallback', async () => {
    if (redis.status !== 'ready') return;

    await service.getRate('BTC/USD');

    const lastGood = await ratesCache.getLastGood('BTC/USD');
    expect(lastGood).not.toBeNull();
    expect(lastGood!.mid).toBe(87450);
  });

  it('should use last-good when provider fails after initial cache', async () => {
    if (redis.status !== 'ready') return;

    // First: populate last-good
    await service.getRate('BTC/USD');

    // Clear spot cache to simulate expiry
    await redis.flushdb();

    // Re-set last-good manually
    await ratesCache.setLastGood('BTC/USD', {
      pair: 'BTC/USD',
      mid: 86000,
      bid: 85900,
      ask: 86100,
      sourceCount: 1,
      sources: ['kraken'],
      calculatedAt: new Date().toISOString(),
      stale: false,
      derived: false,
    });

    // Make provider fail
    const kraken = testProviders[0]!;
    (kraken.getTicker as jest.Mock).mockRejectedValueOnce(new Error('API down'));

    const result = await service.getRate('BTC/USD');
    expect(result).not.toBeNull();
    expect(result!.stale).toBe(true);
    expect(result!.mid).toBe(86000);
  });

  it('should update provider health state in Redis', async () => {
    if (redis.status !== 'ready') return;

    await service.getRate('BTC/USD');

    const healthState = await ratesCache.getProviderHealth('kraken');
    expect(healthState).not.toBeNull();
    expect(healthState!.available).toBe(true);
  });

  it('should get all rates including derived pairs', async () => {
    if (redis.status !== 'ready') return;

    const results = await service.getAllRates();
    expect(results.length).toBeGreaterThan(0);

    const pairs = results.map((r) => r.pair);
    expect(pairs).toContain('BTC/USD');
    expect(pairs).toContain('KES/USD');
    expect(pairs).toContain('KES/BTC');
  });

  it('should return health report', async () => {
    if (redis.status !== 'ready') return;

    const report = await service.getHealthReport();
    expect(report).toBeDefined();
  });
});
