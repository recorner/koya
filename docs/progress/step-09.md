# Step 09 — Bank-Grade Rates Provider

**Status:** Complete  
**Date:** 2026-03-19  
**Depends On:** Step 08 — Foundational Redis Caching Layer

---

## Scope

Build a production-minded **Rates Provider** as a resilient rate intelligence module that fetches from multiple crypto/FX providers, normalizes responses, derives Koya trading pairs through intermediaries, caches in Redis, tracks provider health, falls back to last-good prices safely, and exposes quote-safe pricing via REST endpoints.

**Goal:** A multi-provider pricing layer that powers conversion quotes, guest swap flows, WhatsApp RATES, dashboard market data, and future execution routing.

---

## Architecture

```
RatesModule
├── Providers (Binance, Kraken, FX)
│   └── Each implements RatesProvider interface
├── Aggregation
│   ├── RatesValidator (numeric, staleness, divergence checks)
│   ├── RatesRouteBuilder (derived pair computation)
│   └── RatesAggregator (multi-provider consensus via median)
├── Cache
│   └── RatesCache (wraps CacheService for rate-specific ops)
├── Health
│   └── RatesHealth (provider status, pair freshness, cache health)
├── RatesService (main entrypoint: resolve → cache → aggregate → derive)
└── RatesController (REST endpoints)
```

### Key Design Decisions

1. **Multi-provider aggregation** — Rates are fetched from all providers that support a pair in parallel. Invalid, stale, or divergent results are rejected. The final price is the median of valid mids.

2. **Deterministic derivation** — Derived pairs (KES/BTC, BTC/KES, etc.) are computed through known intermediary routes (e.g., `KES/BTC = KES/USD × (1/BTC/USD)`). Route definitions are declarative in constants.

3. **Redis-backed caching** — Reuses the existing CacheService and CacheNamespace system. Spot rates cached at 5s TTL (crypto) or 60s (FX). Derived rates at 60s. Last-good fallbacks at 10 minutes.

4. **Graceful degradation** — If all providers fail, the service falls back to `rates:lastgood:<pair>` with `stale: true` flag. Callers always know freshness state.

5. **Provider health tracking** — After each fetch cycle, provider health state is persisted in Redis. Three consecutive failures mark a provider unavailable.

6. **FX mock-first** — KES/USD uses a mock provider with realistic rate (~129 KES/USD) and small jitter. Swappable to a real FX API by implementing the `RatesProvider` interface.

7. **No business spread** — This module returns raw market rates. Spread is applied by the quote engine (separate module).

---

## Supported Pairs

### Direct (source-fed)
| Pair | Provider(s) |
|------|-------------|
| BTC/USD | Kraken |
| BTC/USDT | Binance |
| BTC/USDC | Binance |
| USDT/USD | Kraken |
| USDC/USD | Kraken |
| KES/USD | FX (mock) |

### Derived (computed through intermediaries)
| Pair | Route |
|------|-------|
| KES/BTC | KES/USD × (1 / BTC/USD) |
| KES/USDT | KES/USD × (1 / USDT/USD) |
| KES/USDC | KES/USD × (1 / USDC/USD) |
| BTC/KES | BTC/USD × (1 / KES/USD) |
| USDT/KES | USDT/USD × (1 / KES/USD) |
| USDC/KES | USDC/USD × (1 / KES/USD) |
| USDT/USDC | USDT/USD × (1 / USDC/USD) |

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/rates` | All supported pair snapshots |
| GET | `/api/v1/rates/:pair` | Single pair (URL format: `BTC-USD`) |
| GET | `/api/v1/rates/health` | Module health report |
| GET | `/api/v1/health/rates` | Rates health (via main health controller) |

### Query Parameters
- `?fresh=true` — Filter to non-stale rates only
- `?includeSources=true` — Include source provider names in response

---

## Redis Key Usage

| Namespace | Pattern | TTL |
|-----------|---------|-----|
| `rates:spot` | `rates:spot:BTC/USD` | 5s (crypto) / 60s (fiat) |
| `rates:derived` | `rates:derived:KES/BTC` | 60s |
| `rates:lastgood` | `rates:lastgood:BTC/USD` | 600s |
| `provider_health` | `provider_health:binance` | 60s |

---

## Files Created

| File | Purpose |
|------|---------|
| `src/rates/rates.types.ts` | `NormalizedRate`, `RateSnapshot`, `ProviderHealthState`, `RatesHealthResponse` |
| `src/rates/rates.constants.ts` | Direct/derived pairs, derivation routes, staleness thresholds, provider pair support, symbol maps, helpers |
| `src/rates/providers/provider.interface.ts` | `RatesProvider` interface: `getTicker()`, `getMany()`, `getHealth()` |
| `src/rates/providers/binance.provider.ts` | Binance public API adapter (`/api/v3/ticker/bookTicker`) |
| `src/rates/providers/kraken.provider.ts` | Kraken public API adapter (`/0/public/Ticker`) |
| `src/rates/providers/fx.provider.ts` | Mock FX provider for KES/USD (~129 KES/USD with jitter) |
| `src/rates/aggregation/rates.validator.ts` | Numeric validation, staleness detection, divergence checks |
| `src/rates/aggregation/rates.route-builder.ts` | Derived pair computation from leg snapshots |
| `src/rates/aggregation/rates.aggregator.ts` | Multi-provider consensus (median of valid mids) |
| `src/rates/cache/rates.cache.ts` | Rate-specific cache ops on top of CacheService |
| `src/rates/health/rates.health.ts` | Module health: provider status, pair freshness, cache health |
| `src/rates/rates.service.ts` | Main entrypoint: resolve → cache → aggregate → derive pipeline |
| `src/rates/rates.controller.ts` | REST endpoints for rates and health |
| `src/rates/rates.module.ts` | NestJS module wiring with provider array factory |
| `src/rates/__tests__/rates.constants.spec.ts` | Constants and helper unit tests |
| `src/rates/__tests__/rates.validator.spec.ts` | Validator unit tests (15 cases) |
| `src/rates/__tests__/rates.route-builder.spec.ts` | Route builder unit tests (15 cases) |
| `src/rates/__tests__/rates.aggregator.spec.ts` | Aggregator unit tests (10 cases) |
| `src/rates/__tests__/rates.service.spec.ts` | Service unit tests with mocked cache (12 cases) |
| `src/rates/__tests__/rates.integration.spec.ts` | Integration tests with real Redis (8 cases) |

## Files Modified

| File | Change |
|------|--------|
| `src/app/app.module.ts` | Added `RatesModule` to imports |
| `src/app/app.service.ts` | Injected `RatesService`, added rates health to `getHealth()` and `getRatesHealth()` |
| `src/app/app.controller.ts` | Added `GET /health/rates` endpoint |

---

## Service Responsibilities

### `RatesService`
Main entrypoint for all rate consumers.
- Resolve requested pair (direct vs derived)
- Check cache for fresh value
- Fetch from providers via aggregator if cache miss/stale
- Derive computed pairs through route builder
- Fall back to last-good on failure
- Track provider health state

### `RatesAggregator`
- Fetch from all providers supporting a pair in parallel
- Reject invalid/stale responses via validator
- Check divergence across providers
- Compute median consensus snapshot

### `RatesRouteBuilder`
- Determine derivation path for computed pairs
- Compute derived rates from direct leg snapshots
- Handle inversion (e.g., `!BTC/USD` = 1 / BTC_USD)

### `RatesValidator`
- Numeric validation (NaN, Infinity, negative, zero)
- Bid/ask ordering check
- Staleness detection (crypto: 10s, fiat: 5min)
- Cross-provider divergence check (2% threshold)

### Provider Adapters
- External API call with timeout
- Provider-specific response mapping to `NormalizedRate`
- Zero business logic

---

## Tests

### Unit Tests (52+ tests — no Redis required)

| File | Cases | Coverage |
|------|-------|----------|
| `rates.constants.spec.ts` | 8 | parsePair, isDirectPair, isDerivedPair, stalenessThreshold, ALL_PAIRS |
| `rates.validator.spec.ts` | 15 | isValid (9), isStale (4), checkDivergence (4), isSnapshotStale (2) |
| `rates.route-builder.spec.ts` | 15 | getRoute (7), getRequiredDirectPairs (2), derive (8 including math) |
| `rates.aggregator.spec.ts` | 10 | single provider, median 2/3 providers, skip unsupported, failure handling, stale rejection, divergence |
| `rates.service.spec.ts` | 12 | cache hit/miss, stale refresh, last-good fallback, derived resolution, getAllRates, unsupported pair, health delegation |

### Integration Tests (8 tests — requires Redis)

| Test | What It Verifies |
|------|------------------|
| Fetch and cache direct rate | Provider → Redis round-trip |
| Serve from cache on second read | Cache hit skips provider call |
| Compute and cache derived rate | KES/BTC derivation + Redis storage |
| Persist last-good for fallback | Last-good written on successful fetch |
| Use last-good when provider fails | Stale fallback with `stale: true` |
| Update provider health state | Health persisted in Redis after fetch |
| Get all rates including derived | End-to-end multi-pair resolution |
| Return health report | Health check delegation |

### Test Results

```
Test Suites: 16 passed, 16 total
Tests:       241 passed, 241 total
```

All existing tests continue to pass — zero regressions.

---

## Staleness & Safety Rules

| Condition | Behaviour |
|-----------|-----------|
| Crypto rate > 10s old | Marked stale, re-fetched on next read |
| Fiat FX rate > 5min old | Marked stale, re-fetched on next read |
| Derived rate has stale leg | Derived result marked `stale: true` |
| All providers fail | Fall back to `rates:lastgood:<pair>`, marked stale |
| No last-good available | Return null |
| Provider divergence > 2% | Log warning, still use median (not dropped) |
| 3+ consecutive provider failures | Provider marked unavailable in health |

---

## Running Tests

```bash
# Unit tests only (no Redis — runs in CI)
pnpm nx test api --testPathPattern="rates" --testPathIgnorePatterns="integration"

# All tests including integration (needs Redis)
docker compose up redis -d
pnpm nx test api --testPathPattern="rates.integration"

# Full test suite
pnpm nx test api
```

---

## Constraints (per engine.md)

- No business spread applied — raw market rates only
- No quote issuance logic
- No execution/delivery logic
- No ledger truth stored in Redis
- Not tightly coupled to one exchange
- Module is for trusted price retrieval and derivation only

---

## Dependencies

No new dependencies added. Uses existing:
- `axios ^1.6.0` — HTTP client for provider API calls
- `ioredis ^5.10.0` — Redis client (via CacheModule)

---

## Next Steps

- **Quote Engine** — Consume `RatesService` to issue time-limited quotes with Koya spread applied
- **Real FX Provider** — Swap `FxProvider` mock for Open Exchange Rates or CurrencyLayer
- **Scheduled Warming** — Optional `@Cron` to proactively warm core pair caches
- **WhatsApp RATES Command** — Wire the existing WhatsApp flow to query `RatesService` for live rates display
