# Bria Deployment Runbook (Private AWS)

## Production Topology
- Bria runs on private ECS/Fargate tasks.
- Bria uses private service discovery (`koya-bria.koya.internal`).
- Bria database is private RDS PostgreSQL.
- Bria gRPC ports are private only (no public load balancer).
- Bria secrets (`PG_CON`, `SIGNER_ENCRYPTION_KEY`) are from Secrets Manager.

## Runtime Network Rules
- Bria v0.1.131 runtime supports: `bitcoin`, `testnet`, `signet`, `regtest`.
- Koya policy `BTC_NETWORK=testnet4` maps to Bria runtime `BRIA_NETWORK=testnet`.
- Koya policy `BTC_NETWORK=bitcoin` maps to Bria runtime `BRIA_NETWORK=bitcoin`.
- staging/production must not run regtest.

## Config Schema (Required)
Bria config must use upstream schema root:
- `db.*`
- `app.blockchain.*`
- `app.jobs.*`
- `app.fees.*`
- `app.security.*`
- `api.*`
- `admin.*`

Using top-level `blockchain:` causes fallback behavior and can surface regtest-family addresses.

## Deploy
```bash
./scripts/deploy-bria.sh <staging|production> <image-tag> [--build]
```

Post-deploy the script runs:
```bash
./scripts/validate-bria-private.sh <environment>
```

Validation enforces:
- no load balancer on Bria service
- `assignPublicIp=DISABLED`
- subnets do not auto-map public IPs

## Wallet Provisioning and Verification
Preflight lineage snapshot (non-mutating):
```bash
./scripts/inspect-bria-lineage.sh <staging|production>
```

```bash
./scripts/provision-bria-wallet.sh <staging|production>
```

Fresh-lineage reprovision (recommended when address family mismatch persists):
```bash
./scripts/provision-bria-wallet.sh <staging|production> --fresh-lineage --lineage-tag <yyyymmddhhmmss>
```

End-to-end reprovision helper (inspect -> fresh lineage -> persist env lineage refs -> validate):
```bash
./scripts/reprovision-bria-lineage.sh <staging|production> [--lineage-tag <yyyymmddhhmmss>] [--deploy]
```

Post-deploy runtime lineage check (ECS task env vs source-of-truth):
```bash
./scripts/verify-bria-runtime-lineage.sh <staging|production>
```

The provisioning script fails fast if the verification address family does not match Koya policy network.
The script now writes generated Bria keys to a protected temp file path and never prints key material to stdout/stderr.
If descriptor reuse is detected, provisioning fails with a lineage-guard error instead of silently reusing incompatible wallet lineage.

Post-deploy address-family probe (API + Bria end-to-end):
```bash
./scripts/validate-bria-address-family.sh <staging|production> [wallet_name]
# optional private endpoint override:
./scripts/validate-bria-address-family.sh <staging|production> [wallet_name] --api-base-url http://<private-api-host>:3333
```

If this probe reports `bcrt1...` while `BTC_NETWORK=testnet4`, treat it as a hard failure.

## Health
- API connectivity (private path): `GET /api/v1/internal/health/bria`
- Backend health (private path): `GET /api/v1/internal/btc-backend/health` (admin key)

Note: these internal endpoints are intended for private/VPC access. Public API edge paths can return `404` even when service startup logs show the routes mapped.

## Address-Family Mismatch Playbook (`bcrt1...` in testnet4 mode)
1. Confirm runtime mapping is correct:
   - `BTC_NETWORK=testnet4`
   - `BRIA_NETWORK=testnet`
2. Run `./scripts/inspect-bria-lineage.sh ...` and capture the active lineage snapshot.
3. Run `./scripts/validate-bria-address-family.sh ...` and capture the emitted address family.
4. If mismatch persists, inspect Bria wallet lineage:
   - legacy regtest-era wallet material may still exist in the Bria tenant/database.
   - creating a new wallet from the same descriptor can fail with `DescriptorAlreadyInUse`.
5. Remediate deterministically:
   - provision fresh wallet material (new descriptor/xpub branch with signer path), or
   - re-bootstrap Bria on a fresh tenant/database, then re-provision wallet and payout queue.
6. Re-run:
   - `./scripts/inspect-bria-lineage.sh ...`
   - `./scripts/provision-bria-wallet.sh ...`
   - `./scripts/validate-bria-address-family.sh ...`
   - payout submission and event-reconciliation smoke checks.

## Production Network Posture
- Current production testing posture:
  - `BTC_PRODUCTION_NETWORK_MODE=testnet4`
  - `BTC_NETWORK=testnet4`
  - `BRIA_NETWORK=testnet`
- Mainnet cutover posture (future):
  - `BTC_PRODUCTION_NETWORK_MODE=mainnet`
  - `BTC_NETWORK=bitcoin`
  - `BRIA_NETWORK=bitcoin`
  - require address-family validation gate (`bc1...`) before funding.

## Legacy Stack Isolation Checklist
- Confirm active production control plane is `koya-production` cluster and `koya-api-service-production` / `koya-bria-service-production`.
- Confirm legacy `koya` cluster services are not referenced by deploy scripts, env files, or runbooks for production operations.
- If legacy `koya-api` service still runs, either:
  - decommission it, or
  - isolate/document it as non-production and deny write operations.

## Security
- Never expose Bria gRPC publicly.
- Keep signing keys and DB credentials in Secrets Manager only.
- Rotate `SIGNER_ENCRYPTION_KEY` and API keys using controlled runbooks.
