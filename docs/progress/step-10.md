# Step 10 — Bria Bitcoin Custody Integration

**Status:** Complete  
**Date:** 2026-03-20  
**Depends On:** Step 09 — Bank-Grade Rates Provider

---

## Scope

Integrate **Bria** (GaloyMoney's open-source Bitcoin custody/payout daemon) as a first-class Docker service in the Koya infrastructure. Bria handles on-chain BTC operations: wallet management, address derivation, payout submission, UTXO tracking, and transaction batching via gRPC.

**Goal:** A running, healthy Bria container connected to testnet4 via public Electrum, with its own Postgres 16 database, ready for the NestJS adapter integration that will power BTC delivery in the guest conversion flow.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                docker-compose.yml               │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  redis   │  │   api    │  │   bria-pg    │  │
│  │ (cache)  │  │ (NestJS) │  │  (PG 16)     │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │          │
│       │         ┌────┴─────┐         │          │
│       └─────────┤   bria   ├─────────┘          │
│                 │  (gRPC)  │                    │
│                 └────┬─────┘                    │
│                      │                          │
└──────────────────────┼──────────────────────────┘
                       │
              mempool.space:40002
              (testnet4 Electrum)
```

### Key Design Decisions

1. **No local bitcoind/Fulcrum** — Uses public mempool.space Electrum server for testnet4 UTXO indexing. Eliminates ~100GB chain sync and simplifies local dev. Production will use dedicated Electrum infrastructure.

2. **Local Postgres 16 container** — Bria requires PG ≤16 due to a `uuid_nil()` function inlining bug in PG 18 that breaks Bria's sqlx migrations. The `bria-pg` service runs PG 16-alpine alongside Koya's existing remote PG 18.

3. **Multi-stage Docker build** — `clux/muslrust:stable` for Rust release compilation → `alpine:3.19` runtime. Final image is ~22MB with non-root user, `ca-certificates`, and `netcat-openbsd` for health checks.

4. **gRPC-only service** — Bria exposes gRPC on ports 2742 (API) and 2743 (Admin). No HTTP/REST. Future NestJS adapter will use generated TS gRPC client.

5. **Env-driven configuration** — CLI args resolved via `PG_CON`, `SIGNER_ENCRYPTION_KEY`, `BRIA_CONFIG` env vars. Docker CMD is simply `["bria", "daemon", "run"]`.

6. **Read-only config mount** — `config/bria.yml` mounted as `:ro` to prevent container from modifying its own configuration.

---

## Docker Services Added

| Service | Image | Purpose | Port |
|---------|-------|---------|------|
| `bria-pg` | `postgres:16-alpine` | Bria's dedicated PostgreSQL database | `127.0.0.1:5433` |
| `bria` | `koyabank/bria:latest` | Bitcoin custody daemon (gRPC) | `127.0.0.1:2742-2743` |

---

## Files Created

| File | Purpose |
|------|---------|
| `Dockerfile.bria` | Multi-stage Rust build → Alpine runtime (22MB, non-root user `bria:1001`) |
| `config/bria.yml` | Bria config: testnet4 network, `mempool.space:40002` Electrum, ports 2742/2743 |
| `config/bria.yml.example` | Template with placeholder values and comments |
| `docker/bria.env` | Real env values (gitignored): `PG_CON`, `SIGNER_ENCRYPTION_KEY`, `RUST_LOG` |
| `docker/bria.env.example` | Template with placeholder values and setup instructions |
| `docker/run-bria.sh` | Run helper mirroring `docker/run.sh` pattern (`--build` flag, env check, log tail) |
| `docs/deployment/bria-runbook.md` | Operational runbook: env vars, health checks, key rotation, security notes, troubleshooting |
| `tasks/bria-adapter-todo.md` | Future NestJS `BriaClientService` adapter spec with gRPC methods and idempotency strategy |

## Files Modified

| File | Change |
|------|--------|
| `docker-compose.yml` | Added `bria-pg` and `bria` services with health checks, dependencies, read-only volume mounts |
| `.gitignore` | Added `docker/bria.env` |
| `.github/workflows/ci.yml` | Added `bria-build` job: Docker image build + compose config validation |
| `tasks/lessons.md` | Added PG 18 uuid-ossp inlining bug lesson + Bria CLI syntax correction |

## Files Removed

| File | Reason |
|------|--------|
| `config/fulcrum.conf` | No longer needed — using public Electrum instead of local Fulcrum+bitcoind |

---

## Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `PG_CON` | Postgres connection string for local `bria-pg` container | `docker/bria.env` |
| `SIGNER_ENCRYPTION_KEY` | 32-byte hex key for signing credential encryption | `docker/bria.env` |
| `BRIA_HOME` | Token/PID file directory (`/bria`) | `docker/bria.env` |
| `BRIA_CONFIG` | Config file path (`/etc/bria/bria.yml`) | `docker/bria.env` |
| `RUST_LOG` | Logging level (`info`) | `docker/bria.env` |

---

## Verification Evidence

### Docker Compose Status

```
NAME           IMAGE                  STATUS                  PORTS
koya-bria      koyabank/bria:latest   Up (healthy)            127.0.0.1:2742-2743->2742-2743/tcp
koya-bria-pg   postgres:16-alpine     Up (healthy)            127.0.0.1:5433->5432/tcp
koya-redis     redis:7-alpine         Up (healthy)            0.0.0.0:6379->6379/tcp
koya-api       koya-api               Up                      127.0.0.1:3333->3333/tcp
```

### Image Verification

```
$ docker run --rm koyabank/bria bria --version
bria 0.1.115-dev

$ docker image inspect koyabank/bria --format '{{.Size}}'
21921255  (≈22MB — well under 200MB target)

$ docker image inspect koyabank/bria --format '{{.Config.User}}'
bria  (non-root)
```

### Port Accessibility

```
$ nc -z localhost 2742
Connection to localhost (127.0.0.1) 2742 port [tcp/*] succeeded!
```

### Daemon Logs (successful startup)

```
Job `sync_all_wallets` started.
Job `sync_all_wallets` completed in 0.005s.
Job `process_all_payout_queues` started.
Job `process_all_payout_queues` completed in 0.004s.
Polling for messages...
```

Migrations ran successfully, job scheduler active, gRPC listening on 2742/2743.

---

## CI Integration

Added `bria-build` job to `.github/workflows/ci.yml` (runs parallel to `validate`):

1. Checkout repo
2. `docker compose config --quiet` — validate compose syntax
3. `docker build -t koyabank/bria -f Dockerfile.bria .` — build image
4. Verify binary exists at `/usr/local/bin/bria`

Lightweight — no database or runtime deps needed in CI.

---

## Lessons Learned

### PG 18 uuid-ossp Function Inlining Bug

DigitalOcean managed Postgres is on PG 18.3. Bria's sqlx migrations use `uuid_nil()` from the `uuid-ossp` extension inside SQL functions (e.g., `mq_uuid_exists()`). PG 18 tries to inline these functions during index creation and fails to resolve `uuid_nil()` — even though the function exists and works when called directly.

**Fix:** Use local PG 16 container. Bria requires PG ≤16 until upstream migrations are updated.

### Bria CLI Syntax

The engine.md spec had `bria daemon --config ... ${BRIA_DATABASE_URL} prod` — this is incorrect. The actual subcommand is `run` (not `prod`), and the database env var is `PG_CON` (not `BRIA_DATABASE_URL`). All args are read from environment variables, so Docker CMD is simply `["bria", "daemon", "run"]`.

---

## Security Checklist

- [x] `docker/bria.env` is gitignored — no secrets in version control
- [x] `docker/bria.env.example` has placeholder values only
- [x] Config mounted read-only (`:ro`)
- [x] Container runs as non-root user (`bria:1001`)
- [x] gRPC ports bound to `127.0.0.1` only — not exposed publicly
- [x] Runbook documents Secrets Manager usage for production
- [x] Runbook warns against exposing gRPC publicly
- [x] Image is ~22MB — minimal attack surface

---

## Next Steps

- [ ] **Step 11:** Build NestJS `BriaClientService` adapter (`libs/bria-adapter/`) — see `tasks/bria-adapter-todo.md`
  - Generate TS gRPC client from `bria/proto/api/bria.proto` + `bria/proto/admin/api.proto`
  - Implement `bootstrap()`, `createWallet()`, `newAddress()`, `submitPayout()`, `subscribeAll()`
  - Idempotency via `external_id` linked to Koya `conversion_session.id`
- [ ] Bootstrap Bria admin and create initial account/profile for Koya
- [ ] Import testnet4 xpub and create HD wallet
- [ ] Wire BTC delivery in guest conversion flow (replace `MockBtcDeliveryProvider`)
