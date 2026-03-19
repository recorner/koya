# KOYA — Foundational Redis Caching Layer
### Infrastructure Module Build Prompt

Version: 1.0  
Target: NestJS Nx Monorepo  
Purpose: Build the shared caching infrastructure used by all Koya services.

---

# 1. Context

Koya Bank is a borderless financial infrastructure platform that includes:

- multi-currency wallets
- crypto-fiat conversion
- M-Pesa payments
- guest swaps
- WhatsApp transactions

The backend architecture is a NestJS monorepo where Redis acts as the system-wide caching layer alongside PostgreSQL.

Redis will support:

- rate caching
- sessions
- quote TTL storage
- distributed locks
- idempotency keys
- provider health states
- temporary operational state

Redis NEVER stores financial truth.  
All financial records remain in the ledger database.

---

# 2. Objective

Build a production-grade Redis caching layer that:

- runs as a dedicated container
- is shared across all services
- provides typed caching utilities
- enforces TTL policies
- supports locks and idempotency
- enables resilient system behaviour

This layer will power upcoming modules such as:

- rates provider
- quote engine
- session management
- conversion engine

---

# 3. First Step — Study the Repository

Before writing any code:

1. Inspect the current monorepo structure.

Expected layout:

apps/  
&nbsp;&nbsp;api/  
&nbsp;&nbsp;web/  
&nbsp;&nbsp;whatsapp/  

libs/  
&nbsp;&nbsp;shared/  
&nbsp;&nbsp;ledger/  
&nbsp;&nbsp;crypto/  

Focus especially on:

apps/api/src

Understand:

- module structure
- dependency injection patterns
- environment config system
- logging strategy

Do not introduce architecture that conflicts with existing patterns.

---

# 4. Infrastructure Requirement

Redis must run as a dedicated container accessible by all services.

Update docker-compose.yml.

Example:

```yaml
redis:
  image: redis:7-alpine
  container_name: koya-redis
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 5
```

Add persistent volume:

```yaml
volumes:
  redis_data:
```

Goals:

- persistence enabled
- stable service name
- healthcheck
- minimal configuration

---

# 5. Cache Module

Create a new module inside the API.

Location:

apps/api/src/cache

Structure:

cache/  
├── cache.module.ts  
├── cache.service.ts  
├── redis.provider.ts  
├── cache.constants.ts  
├── cache.types.ts  

---

# 6. Redis Client

Use an async Redis client such as:

ioredis

Connection should support:

- auto reconnect
- TLS option
- password authentication
- graceful shutdown

The client must be injected using NestJS dependency injection.

---

# 7. Cache Service Capabilities

The cache service must expose safe helpers.

## Basic Operations

- get(key)
- set(key, value, ttl?)
- delete(key)
- exists(key)

## JSON Helpers

- getJSON(key)
- setJSON(key, object, ttl?)

## Atomic Operations

- setIfNotExists(key, value, ttl)
- increment(key)

## Distributed Locks

- acquireLock(resource, ttl)
- releaseLock(resource)

Used for:

- quote locking
- transaction safety
- idempotent execution

---

# 8. Key Namespace Design

All Redis keys must follow a strict naming structure.

Examples:

session:<session_id>

rates:spot:<pair>  
rates:derived:<pair>  
rates:lastgood:<pair>  

quote:<quote_id>  

quote_lock:<quote_id>  

idempotency:<key>  

provider_health:<provider>  

lock:<resource>

---

# 9. TTL Strategy

Implement TTL defaults.

| Use Case | TTL |
|----------|-----|
Crypto spot price | 2–5 seconds |
FX fiat rate | 30–120 seconds |
Derived conversion rates | same as underlying |
Quotes | 30 seconds |
Provider health flags | 60 seconds |
Locks | 5–10 seconds |

TTL must be configurable through environment variables.

---

# 10. Configuration

Add environment variables:

REDIS_HOST  
REDIS_PORT  
REDIS_PASSWORD  
REDIS_DB  
REDIS_TLS  

Config validation should run at startup.

If Redis cannot connect:

- log error
- retry with exponential backoff

---

# 11. Health Checks

Implement:

/health/cache

Health indicator must check:

- redis ping
- latency threshold

Expose status to readiness probes.

---

# 12. Failure Behaviour

If Redis becomes unavailable:

- system should not crash
- critical operations must fallback gracefully

Examples:

- rate cache miss → fetch fresh price
- session cache miss → validate DB
- quote lock failure → retry

---

# 13. Logging

All cache errors must be logged with:

- operation
- key
- error message
- timestamp

Avoid logging sensitive values.

---

# 14. Testing

Provide tests.

## Unit Tests

Verify:

- set/get
- TTL expiry
- key namespace
- JSON helpers

## Integration Tests

Verify:

- Redis connectivity
- lock correctness
- concurrent writes
- expiration behaviour

---

# 15. Documentation

Produce short internal documentation covering:

- how cache keys are structured
- recommended TTL policies
- how other modules use the cache
- examples of usage

---

# 16. Constraints

Do NOT:

- store ledger balances in Redis
- store irreversible financial state
- introduce Redis clustering yet
- overengineer the solution

This is foundational infrastructure only.

---

# 17. Deliverables

Expected outputs:

- docker-compose Redis service
- cache module inside API
- typed cache service
- Redis provider
- key namespace helpers
- environment config
- health indicator
- tests
- documentation

---

# 18. Success Criteria

The system is complete when:

- Redis container starts with stack
- API connects successfully
- cache set/get works
- TTL expiration works
- locks work correctly
- other modules can inject CacheService

This prepares the system for the Rates Provider module that will rely on this caching layer.
