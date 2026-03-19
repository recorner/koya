# Step 09 — Bank-Grade Rates Provider

**Status:** Ready to Build  
**Depends On:** Step 08 — Foundational Redis Caching Layer  
**Target:** `apps/api/src/rates`

---

## Objective

Build Koya’s **Rates Provider** as a production-minded pricing layer for the conversion engine.

This is **not** just a wrapper around one exchange API.

It must act as a **resilient rate intelligence module** that:

- fetches rates from multiple providers
- normalizes provider responses into one internal format
- derives Koya trading pairs from core market pairs
- caches live results in Redis
- tracks provider health
- falls back to last-good prices safely
- exposes quote-safe pricing to the rest of the platform

This module will power:

- conversion quotes
- guest swap flows
- WhatsApp `RATES`
- dashboard market data
- future execution routing

---

## First Step — Study Existing Structure

Before writing code:

1. Inspect the current API structure and conventions.
2. Study the completed CacheModule and reuse it directly.
3. Follow existing NestJS DI, config, logging, and health-check patterns.
4. Do not invent a parallel architecture.

This module must integrate cleanly into the monorepo and use the already completed Redis layer.

---

## Architectural Intent

Koya’s conversion engine already assumes:

- prices come from multiple sources
- volatile pairs use Redis-backed short TTL caching
- quotes are valid for a short window
- most KES routes should go through USD as intermediary

Do **not** try to maintain separate direct pricing engines for every pair.

Use the core routing model:

- BTC ↔ USD
- BTC ↔ USDT
- BTC ↔ USDC
- USDT ↔ USD
- USDC ↔ USD
- KES ↔ USD

Then derive:

- KES/BTC
- KES/USDT
- KES/USDC
- BTC/KES
- USDT/KES
- USDC/KES

---

## Supported Pairs

### Direct / source-fed pairs
- BTC/USD
- BTC/USDT
- BTC/USDC
- USDT/USD
- USDC/USD
- KES/USD

### Derived pairs
- KES/BTC
- KES/USDT
- KES/USDC
- BTC/KES
- USDT/KES
- USDC/KES
- USDT/USDC

Do not hardcode only one route.  
The module should be able to derive pairs through known intermediaries safely.

---

## Provider Strategy

Implement provider adapters, not provider-specific logic scattered everywhere.

### Initial providers

#### Crypto providers
- Binance (primary)
- Kraken (backup / validation)

#### Fiat / KES provider
- configurable FX provider adapter
- for now support a placeholder/mock adapter interface if final provider credentials are not yet available

### Requirements
Each provider must have its own adapter class implementing a shared interface.

Each adapter should expose methods like:

- `getTicker(pair)`
- `getMany(pairs)`
- `getHealth()`

Provider responses must be normalized into one internal structure.

---

## Internal Rate Model

Use a normalized internal rate object such as:

```ts
type NormalizedRate = {
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
};
```

Also define a derived/aggregated snapshot model such as:

```ts
type RateSnapshot = {
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
};
```

---

## Redis Integration

Reuse the existing CacheService.

Use the cache namespaces already established:

- `rates:spot:<pair>`
- `rates:derived:<pair>`
- `rates:lastgood:<pair>`
- `provider_health:<provider>`

### TTL policy
Follow the existing Redis strategy:

- crypto spot rates: 5 seconds
- fiat FX rates: 60 seconds
- derived rates: 60 seconds or tighter if based on volatile components
- provider health flags: 60 seconds

### Required behaviour
- fresh rate → cache under appropriate namespace
- derived rate → cache separately from direct spot
- validated last-good snapshot → persist in Redis for safe fallback
- provider health state → update after every fetch cycle

Never store ledger truth here.

---

## Rate Aggregation Logic

Build a consensus layer, not a single-source reader.

### For directly sourced pairs
- fetch from all configured providers that support the pair
- normalize results
- reject invalid or stale responses
- compute final result using a safe strategy such as:
  - median of mids, or
  - weighted median using provider confidence

### For derived pairs
Use deterministic routing.

Examples:

- `KES/BTC = KES/USD × USD/BTC`
- `BTC/KES = BTC/USD × USD/KES`
- `KES/USDT = KES/USD × USD/USDT`
- `USDT/KES = USDT/USD × USD/KES`

Define route builders in a dedicated service.

Do not mix route math with HTTP provider code.

---

## Staleness and Safety Rules

Implement staleness checks.

Suggested defaults:
- crypto rate stale after 10 seconds
- fiat FX stale after 5 minutes
- derived rate stale if any component is stale

If all fresh providers fail:
- attempt to use `rates:lastgood:<pair>`
- mark snapshot as stale
- never present stale fallback as fresh
- ensure callers can see freshness state

If providers disagree too far beyond a tolerance threshold:
- mark pair degraded
- do not silently choose a bad price
- record warning logs and provider health impact

---

## Module Structure

Recommended structure:

```text
apps/api/src/rates
├── rates.module.ts
├── rates.service.ts
├── rates.controller.ts
├── rates.constants.ts
├── rates.types.ts
├── health/
│   └── rates.health.ts
├── providers/
│   ├── provider.interface.ts
│   ├── binance.provider.ts
│   ├── kraken.provider.ts
│   └── fx.provider.ts
├── aggregation/
│   ├── rates.aggregator.ts
│   ├── rates.validator.ts
│   └── rates.route-builder.ts
├── cache/
│   └── rates.cache.ts
└── __tests__/
    ├── rates.service.spec.ts
    ├── rates.aggregator.spec.ts
    ├── rates.route-builder.spec.ts
    └── rates.integration.spec.ts
```

---

## Public API Surface

Expose internal endpoints such as:

### Read endpoints
- `GET /api/v1/rates`
- `GET /api/v1/rates/:pair`
- `GET /api/v1/rates/health`

### Optional query support
- `?fresh=true`
- `?includeSources=true`

Return structured metadata including:
- pair
- price
- freshness
- derived/direct
- sources used
- calculatedAt

---

## Service Responsibilities

### `RatesService`
Main entrypoint for consumers.
Responsibilities:
- resolve requested pair
- fetch cached value if valid
- compute or refresh if needed
- return final snapshot

### `RatesAggregator`
Responsibilities:
- combine multi-provider inputs
- reject bad/stale values
- compute final consensus snapshot

### `RatesRouteBuilder`
Responsibilities:
- determine derivation path
- compute derived rates from core pairs

### `RatesValidator`
Responsibilities:
- numeric validation
- timestamp validation
- divergence checks
- stale detection

### Provider adapters
Responsibilities:
- external API call
- provider-specific mapping
- zero business logic

---

## Health and Observability

Integrate with existing health patterns.

Track:
- provider latency
- provider success/failure count
- cache hit/miss rate
- stale rate usage
- last-good fallback usage
- per-pair degradation events

Add health checks for:
- overall rates module
- provider-level status
- cache status dependency
- freshness of core pairs

---

## Logging

Log at structured, useful points:

- provider fetch started/finished
- provider failure
- invalid provider payload
- rate divergence beyond threshold
- stale fallback used
- cache miss
- derived route selected

Avoid noisy logs on every normal read path unless debugging is enabled.

---

## Testing

Provide strong tests.

### Unit tests
- provider response normalization
- pair routing logic
- derived math correctness
- staleness rules
- divergence rejection
- cache key usage

### Integration tests
- provider adapter integration with mocked upstream responses
- Redis caching flow
- last-good fallback path
- multiple-provider aggregation
- derived pair generation

### Critical assertions
- `KES/BTC` route math is correct
- stale sources are rejected
- cached rates expire correctly
- disagreement threshold handling works
- provider failure does not crash the module

---

## Constraints

Do NOT:
- hardcode business spread into this module
- mix quote issuance logic here
- store financial truth in Redis
- call execution providers from this module
- tightly couple rates logic to one exchange

This module is for **trusted price retrieval and derivation**, not trade execution.

---

## Deliverables

- `RatesModule`
- provider interface and adapters
- aggregation service
- derivation/route builder
- Redis-backed rate cache integration
- last-good fallback logic
- health endpoints
- structured tests
- implementation notes listing files created and modified

---

## Success Criteria

The module is complete when:

- API can return fresh BTC/USD, KES/USD, BTC/KES, and KES/USDT rates
- direct and derived pairs are clearly separated
- rates are cached through the existing CacheService
- provider failures degrade safely
- last-good fallback works
- health endpoints expose module state
- structure is ready for quote-engine integration

---

## Important Product Rule

This module provides **reference and quote-input prices**.

It does **not**:
- execute trades
- lock user funds
- create quotes
- apply Koya spread
- settle ledger entries

That belongs in the quote engine and execution layer.
