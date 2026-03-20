# Bria Deployment Runbook

Bria is the Bitcoin custody and payout service used by Koya for on-chain BTC operations (wallet management, address derivation, payout submission, UTXO tracking).

**gRPC service** — not HTTP/REST. All integration is via Protocol Buffers.

---

## Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PG_CON` | PostgreSQL connection string. Uses local `bria-pg` container (PG 16) by default. Bria requires PG ≤16 due to uuid-ossp inlining issues in PG 18. | `postgres://bria:bria_dev_password@bria-pg:5432/bria` |
| `SIGNER_ENCRYPTION_KEY` | 32-byte hex key for encrypting signing credentials at rest. Generate with `openssl rand -hex 32`. | `ab5846...` (64 hex chars) |
| `BRIA_HOME` | Directory for tokens + PID file. | `/bria` |
| `BRIA_CONFIG` | Path to YAML config file. | `/etc/bria/bria.yml` |
| `RUST_LOG` | Logging level (`error`, `warn`, `info`, `debug`, `trace`). | `info` |

---

## Configuration (bria.yml)

Key settings in `config/bria.yml`:

| Setting | Purpose | Default |
|---------|---------|---------|
| `blockchain.network` | Bitcoin network (`regtest`, `testnet`, `testnet4`, `signet`, `bitcoin`) | `testnet4` |
| `blockchain.electrum_url` | Remote Electrum server for UTXO indexing | `mempool.space:40002` |
| `api.listen_port` | gRPC API port | `2742` |
| `admin.listen_port` | Admin gRPC port | `2743` |
| `db.migrate_on_start` | Run sqlx migrations on daemon startup | `true` |
| `db.pool_size` | PostgreSQL connection pool size | `20` |

---

## Running Locally

### Via Docker Compose (recommended)

```bash
# Start all services (redis, api, bria)
docker compose up -d

# Check status
docker compose ps

# Tail Bria logs
docker logs -f koya-bria
```

### Via Run Helper

```bash
# Build and start Bria standalone
./docker/run-bria.sh --build

# Start without rebuilding
./docker/run-bria.sh
```

### First-Time Setup

1. **Copy env and config templates:**
   ```bash
   cp docker/bria.env.example docker/bria.env
   cp config/bria.yml.example config/bria.yml
   ```

2. **Generate a signer encryption key:**
   ```bash
   openssl rand -hex 32
   ```
   Add the output to `docker/bria.env` as `SIGNER_ENCRYPTION_KEY`.

3. **Start services** (bria-pg is created automatically by docker-compose):
   ```bash
   docker compose up -d
   ```
   The `bria-pg` container (Postgres 16) starts first, Bria runs migrations automatically.

4. **Bootstrap Bria admin** (first run only — creates admin API key):
   ```bash
   docker exec koya-bria bria admin bootstrap
   ```
   Save the admin API key output.

---

## Health Checks

| Check | Command |
|-------|---------|
| gRPC API port | `nc -z localhost 2742` |
| Admin port | `nc -z localhost 2743` |
| Container health | `docker inspect --format='{{.State.Health.Status}}' koya-bria` |
| Docker Compose | `docker compose ps` (look for `healthy` status) |
| Electrum connectivity | Bria logs show `electrum connected` (remote server at mempool.space:40002) |

---

## SIGNER_ENCRYPTION_KEY Rotation

The `SIGNER_ENCRYPTION_KEY` encrypts signing credentials (xpub private data) at rest in PostgreSQL.

**Rotation procedure:**

1. Stop the Bria daemon: `docker compose stop bria`
2. Generate a new key: `openssl rand -hex 32`
3. Re-encrypt existing credentials in the database (requires Bria CLI tooling — see Bria docs)
4. Update `docker/bria.env` with the new key
5. Restart: `docker compose up -d bria`

> **Warning:** Changing the key without re-encrypting existing data will make stored signing credentials unreadable.

---

## Infrastructure Dependencies

```
bria-pg (PG 16)          ← local Postgres for Bria (auto-created by compose)
     │
mempool.space:40002     ← public Electrum server (testnet4)
     │
bria                    ← custody/payout daemon (gRPC)
     │
koya-api (future)       ← NestJS adapter calls Bria gRPC
```

- **bria-pg** is a local Postgres 16 container managed by docker-compose. Bria requires PG ≤16 (PG 18 has uuid-ossp function inlining issues with Bria's sqlx migrations).

---

## Security Notes

### Do NOT expose gRPC publicly

Bria's gRPC ports (2742, 2743) must **never** be exposed to the public internet. They have no TLS or authentication by default.

- In docker-compose, ports are bound to `127.0.0.1` only.
- In production, use a private network or VPN.

### TLS Termination

For production:
- Terminate TLS at the load balancer (ALB/nginx) or use mTLS for gRPC.
- See `nginx/` directory for Koya's TLS patterns.

### Secrets Management

**Development:** Secrets in `docker/bria.env` (gitignored).

**Production:**
- Store `PG_CON` and `SIGNER_ENCRYPTION_KEY` in AWS Secrets Manager, GCP Secret Manager, or HashiCorp Vault.
- Inject secrets via environment variables at deploy time (ECS task definition, K8s secrets, etc.).
- **Never** bake secrets into Docker images.
- Reference `docs/deployment/ecs-fargate.md` for Koya's production deployment patterns.

### Config Mount

The Bria config file (`config/bria.yml`) is mounted **read-only** (`:ro`) in docker-compose. This prevents the container from modifying its own configuration.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `connection refused` on 2742 | Bria not started or crashed | Check `docker logs koya-bria` |
| `database does not exist` | Missing `bria` database | Run `CREATE DATABASE bria;` on PostgreSQL |
| `invalid signer encryption key` | Wrong key format or length | Must be exactly 64 hex characters |
| `uuid_nil() does not exist` | PG version too new (18+) | Use PG ≤16; the docker-compose `bria-pg` service uses PG 16 |
| `electrum connection failed` | Remote Electrum server unreachable | Check network connectivity; verify `electrum_url` in `config/bria.yml` |
| Wallet sync not progressing | Electrum server lagging or unreachable | Try alternative Electrum endpoint; check Bria logs |
| Container keeps restarting | Missing env vars or bad config | Check `docker logs koya-bria` for startup errors |

---

## Ports Reference

| Service | Port | Protocol | Binding |
|---------|------|----------|---------|
| Bria API | 2742 | gRPC | 127.0.0.1 |
| Bria Admin | 2743 | gRPC | 127.0.0.1 |
| Bria PG | 5433 | PostgreSQL | 127.0.0.1 |


---

## Electrum Server Options

Bria requires an Electrum-protocol server for UTXO indexing. Current setup uses a public endpoint:

| Server | Address | Network |
|--------|---------|--------|
| Mempool.space | `mempool.space:40002` | testnet4 (SSL) |

For production, consider:
- Self-hosted Fulcrum backed by a synced bitcoind node
- Dedicated Electrum infrastructure from your Bitcoin node provider
- Update `blockchain.electrum_url` in `config/bria.yml` to switch

---

## Bootstrap Koya Account & Wallet

After Bria is running and the admin key is saved, provision the Koya account, profile, and wallet. This can be done via the dev setup endpoint or manually via the Bria CLI.

### Via API Setup Endpoint (dev only)

The `BriaSetupController` exposes a one-shot endpoint that runs the full provisioning flow:

```bash
curl -X POST http://localhost:3000/api/v1/admin/bria/setup \
  -H "x-admin-api-key: <your-admin-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "xpub": "tpub...",
    "derivation": "m/84h/1h/0h"
  }'
```

This endpoint is only registered when `NODE_ENV !== 'production'`. It performs:
1. Bootstrap admin (idempotent — skips if already done)
2. Create `koya` account
3. Create `default` service profile + generate API key
4. Import xpub and create `koya-wallet`
5. Verify setup

### Via Bria CLI (manual)

```bash
# 1. Bootstrap admin (first run only)
docker exec koya-bria bria admin bootstrap

# 2. Create account
docker exec koya-bria bria admin create-account --name koya

# 3. Create profile (save the API key!)
docker exec koya-bria bria profile create --name default
# → Returns profile_api_key

# 4. Import xpub (testnet4 example)
docker exec koya-bria bria import-xpub \
  --name koya-xpub \
  --xpub "tpub..." \
  --derivation "m/84h/1h/0h"

# 5. Create wallet
docker exec koya-bria bria create-wallet \
  --name koya-wallet \
  --xpub koya-xpub

# 6. Verify
docker exec koya-bria bria wallet-balance --name koya-wallet
```

### Required API Env Vars (after setup)

Once the wallet is provisioned, the API needs these env vars to use the bria driver:

| Variable | Description | Example |
|----------|-------------|---------|
| `BTC_DELIVERY_DRIVER` | Delivery provider selection | `bria` (default: `mock`) |
| `BRIA_API_URL` | Bria gRPC API endpoint | `localhost:2742` |
| `BRIA_API_KEY` | Profile API key from step 3 | `bria_...` |
| `BRIA_ADMIN_URL` | Bria admin gRPC endpoint | `localhost:2743` |
| `BRIA_ADMIN_API_KEY` | Admin API key from bootstrap | `bria_admin_...` |
| `BRIA_WALLET_NAME` | Wallet name for payouts | `koya-wallet` |
| `BRIA_PAYOUT_QUEUE` | Payout queue name (optional) | `default` |
