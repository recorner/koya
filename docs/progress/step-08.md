# Step 08 — Foundational Redis Caching Layer

**Status:** Complete  
**Date:** 2026-03-19

---

## Scope

Build a production-grade Redis caching layer that runs as a dedicated container, is shared across all services, provides typed caching utilities, enforces TTL policies, supports distributed locks and idempotency, and enables resilient system behaviour.

**Goal:** A shared caching infrastructure that powers upcoming modules — rates provider, quote engine, session management, and conversion engine.

---

## Architecture

```
docker-compose.yml
    ├── redis (redis:7-alpine, port 6379, AOF persistence)
    └── api (depends_on redis)

CacheModule (@Global)
    ├── RedisProvider (ioredis factory, ConfigService injection)
    └── CacheService (typed operations, locks, health)
         ├── get / set / delete / exists
         ├── getJSON / setJSON
         ├── setIfNotExists / increment
         ├── acquireLock / releaseLock (Lua script)
         └── ping (health check)
```

### Key Design Decisions

1. **`@Global()` module** — Matches PrismaModule pattern. CacheService is available to all modules without explicit import.
2. **ioredis client** — Superior TypeScript support, auto-reconnect with exponential backoff, TLS support, cluster-ready for future.
3. **Factory provider pattern** — `RedisProvider` uses `useFactory` with `ConfigService` injection (same pattern as TWILIO_ADAPTER).
4. **Lua script for lock release** — Safe distributed lock: only releases if caller's token matches stored value. Prevents accidental release of someone else's lock.
5. **Graceful degradation** — All cache methods wrapped in try/catch. On Redis failure: log error, return null/false. System never crashes due to cache unavailability.
6. **Key namespace enforcement** — All keys follow `namespace:identifier` pattern via `buildKey()` helper and `CacheNamespace` constants.

---

## Key Namespace Design

| Namespace | Pattern | Purpose |
|-----------|---------|---------|
| `session` | `session:<session_id>` | Session state |
| `rates:spot` | `rates:spot:<pair>` | Crypto spot prices |
| `rates:derived` | `rates:derived:<pair>` | Derived conversion rates |
| `rates:lastgood` | `rates:lastgood:<pair>` | Last known good rates |
| `quote` | `quote:<quote_id>` | Quote TTL storage |
| `quote_lock` | `quote_lock:<quote_id>` | Quote locking |
| `idempotency` | `idempotency:<key>` | Idempotency keys |
| `provider_health` | `provider_health:<provider>` | Provider health state |
| `lock` | `lock:<resource>` | Generic distributed locks |

---

## TTL Strategy

| Use Case | Default TTL | Configurable |
|----------|-------------|-------------|
| Crypto spot price | 5 seconds | Yes |
| FX fiat rate | 60 seconds | Yes |
| Derived conversion rates | 60 seconds | Yes |
| Quotes | 30 seconds | Yes |
| Provider health flags | 60 seconds | Yes |
| Distributed locks | 10 seconds | Per-call |

---

## Cache Service API

```typescript
// Basic Operations
cache.get(key): Promise<string | null>
cache.set(key, value, ttlSeconds?): Promise<boolean>
cache.delete(key): Promise<boolean>
cache.exists(key): Promise<boolean>

// JSON Helpers
cache.getJSON<T>(key): Promise<T | null>
cache.setJSON(key, value, ttlSeconds?): Promise<boolean>

// Atomic Operations
cache.setIfNotExists(key, value, ttlSeconds): Promise<boolean>
cache.increment(key): Promise<number | null>

// Distributed Locks
cache.acquireLock(resource, ttlSeconds?): Promise<LockResult>
cache.releaseLock(resource, token): Promise<boolean>

// Health
cache.ping(): Promise<{ ok: boolean; latencyMs: number }>
```

---

## Usage Examples

```typescript
import { CacheService } from '../cache/cache.service';
import { buildKey, CacheNamespace, DefaultTTL } from '../cache/cache.constants';

// Cache a rate
const key = buildKey(CacheNamespace.RATES_SPOT, 'KES/BTC');
await cache.setJSON(key, { rate: 0.000045, ts: Date.now() }, DefaultTTL.CRYPTO_SPOT);

// Retrieve a rate
const rate = await cache.getJSON<{ rate: number; ts: number }>(key);

// Distributed lock for quote processing
const lock = await cache.acquireLock(buildKey(CacheNamespace.QUOTE_LOCK, quoteId), 10);
if (lock.acquired) {
  try {
    // process quote...
  } finally {
    await cache.releaseLock(buildKey(CacheNamespace.QUOTE_LOCK, quoteId), lock.token!);
  }
}

// Idempotency check
const idemKey = buildKey(CacheNamespace.IDEMPOTENCY, requestId);
const isNew = await cache.setIfNotExists(idemKey, 'processing', 60);
if (!isNew) { /* duplicate request */ }
```

---

## Health Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Overall health (now includes `cache.status` and `cache.latencyMs`) |
| GET | `/api/v1/health/cache` | Dedicated cache health (status, latencyMs, timestamp) |

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `REDIS_HOST` | Redis server hostname | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis authentication password | _(empty)_ |
| `REDIS_DB` | Redis database number | `0` |
| `REDIS_TLS` | Enable TLS connection | `false` |

---

## Files Created

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Docker Compose with Redis + API services |
| `apps/api/src/cache/cache.module.ts` | `@Global()` NestJS module |
| `apps/api/src/cache/cache.service.ts` | Typed cache service with all operations |
| `apps/api/src/cache/redis.provider.ts` | ioredis factory provider |
| `apps/api/src/cache/cache.constants.ts` | DI tokens, key namespaces, default TTLs, `buildKey()` |
| `apps/api/src/cache/cache.types.ts` | TypeScript interfaces (`CacheConfig`, `LockResult`) |
| `apps/api/src/cache/__tests__/cache.service.spec.ts` | Unit tests (mocked Redis) |
| `apps/api/src/cache/__tests__/cache.integration.spec.ts` | Integration tests (real Redis) |

## Files Modified

| File | Change |
|------|--------|
| `apps/api/src/app/app.module.ts` | Added `CacheModule` to imports |
| `apps/api/src/app/app.controller.ts` | Added `GET /health/cache` endpoint |
| `apps/api/src/app/app.service.ts` | Injected `CacheService`, added cache health logic to `getHealth()` and `getCacheHealth()` |
| `docker/api.env.example` | Added `REDIS_*` environment variables |
| `docker/api.env` | Added `REDIS_*` defaults |
| `package.json` | Added `ioredis ^5.10.0` dependency |

---

## Tests

### Unit Tests (30 tests — no Redis required)

`cache.service.spec.ts`:
- **CacheService**: get, set (with/without TTL), delete, exists — happy path + error handling (6 cases each)
- **JSON helpers**: getJSON (valid, missing, invalid JSON), setJSON (valid, circular reference)
- **Atomic ops**: setIfNotExists (success, already exists, error), increment (success, error)
- **Distributed locks**: acquireLock (success, already held, error), releaseLock (success, wrong token, error)
- **Health**: ping (success, failure)

`cache.constants` tests:
- `buildKey()` — Verifies namespace:id format for all namespaces
- `DefaultTTL` — Verifies reasonable ranges
- `CacheNamespace` — Verifies all 9 required namespaces

### Integration Tests (11 tests — requires running Redis)

`cache.integration.spec.ts`:
- Connectivity: Redis PING + latency check
- Basic operations: set/get, missing key, delete, exists
- TTL expiry: Key expires after 1 second
- JSON operations: setJSON/getJSON round-trip
- Atomic operations: setIfNotExists (first wins), increment counter
- Distributed locks: acquire + release, concurrent rejection, wrong token rejection, auto-expiry

### Test Results

```
Test Suites: 10 passed, 10 total
Tests:       165 passed, 165 total
```

All existing tests continue to pass — zero regressions.

---

## Docker Setup

```bash
# Start Redis only
docker-compose up redis -d

# Start full stack (API + Redis)
docker-compose up -d

# Run integration tests with Redis
docker-compose up redis -d
pnpm nx test api --testPathPattern="cache.integration"
```

---

## Failure Behaviour

| Scenario | Behaviour |
|----------|-----------|
| Redis unreachable at startup | Log error, retry with exponential backoff (max 5s delay) |
| Redis goes down mid-operation | Log error, return null/false. System stays up. |
| Rate cache miss | Caller fetches fresh price from provider |
| Session cache miss | Caller validates against database |
| Quote lock failure | Caller can retry acquisition |
| Lock auto-expiry | Prevents deadlocks — TTL ensures locks are always released |

---

## Constraints (per engine.md)

- Redis NEVER stores financial truth — all financial records remain in the ledger database
- No Redis clustering — single instance is sufficient for current scale
- No over-engineering — foundational infrastructure only
- This layer prepares the system for the Rates Provider module

---

## Dependencies Added

```
ioredis ^5.10.0    # Redis client with TypeScript support
```
