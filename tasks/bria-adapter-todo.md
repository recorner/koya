# Bria Adapter — NestJS Integration TODO

## Overview

Build a `BriaClientService` in NestJS that wraps Bria's gRPC API for use by the Koya conversion engine and wallet management flows.

**Status:** Not started (infrastructure PR must merge first)

---

## Scope

### Generate gRPC Client

- Source protos: `bria/proto/api/bria.proto` and `bria/proto/admin/api.proto`
- Generate TypeScript gRPC client using `@grpc/proto-loader` + `@grpc/grpc-js` (or `ts-proto`)
- Place generated types in `libs/bria-adapter/src/generated/`

### Create NestJS Module

**Location:** `libs/bria-adapter/`

```
libs/bria-adapter/
├── src/
│   ├── bria-adapter.module.ts
│   ├── bria-client.service.ts
│   ├── bria-admin.service.ts
│   ├── bria-adapter.types.ts
│   ├── bria-adapter.config.ts
│   └── generated/
│       ├── bria.ts           (from bria.proto)
│       └── admin.ts          (from admin/api.proto)
├── package.json
├── tsconfig.json
└── jest.config.ts
```

### Required gRPC Methods

#### Admin Service (`BriaAdminService`)

| Method | Proto RPC | Purpose |
|--------|-----------|---------|
| `bootstrap()` | `AdminService.Bootstrap` | Initialize admin key (first run) |
| `createAccount(name)` | `AdminService.CreateAccount` | Create Bria account for Koya |
| `listAccounts()` | `AdminService.ListAccounts` | List all accounts |

#### Client Service (`BriaClientService`)

| Method | Proto RPC | Purpose |
|--------|-----------|---------|
| `createProfile(name)` | `BriaService.CreateProfile` | Create profile with spending policy |
| `importXpub(xpub, derivation)` | `BriaService.ImportXpub` | Import wallet xpub |
| `createWallet(name, xpubRef)` | `BriaService.CreateWallet` | Create HD wallet |
| `newAddress(walletName, externalId)` | `BriaService.NewAddress` | Derive new receiving address |
| `getWalletBalance(walletName)` | `BriaService.GetWalletBalanceSummary` | Check wallet balance |
| `submitPayout(walletName, destination, amount, externalId)` | `BriaService.SubmitPayout` | Submit BTC payout |
| `estimatePayoutFee(walletName, destination, amount)` | `BriaService.EstimatePayoutFee` | Estimate payout fee |
| `submitSignedPsbt(batchId, xpubRef, signedPsbt)` | `BriaService.SubmitSignedPsbt` | Submit externally signed PSBT |
| `getPayout(id)` | `BriaService.GetPayout` | Track payout status |
| `subscribeAll(afterSequence)` | `BriaService.SubscribeAll` | Stream all events (journal) |

### Idempotency Strategy

Every BTC operation must use `external_id` for idempotency:

```
┌──────────────┐     ┌──────────┐     ┌──────────┐
│  Koya DB     │     │  Bria    │     │  DFNS    │
│              │     │          │     │ (future) │
│ conversion   │     │ payout   │     │ signing  │
│ session_id   │────▶│ ext_id   │────▶│ ext_id   │
│              │     │          │     │          │
│ UNIQUE       │     │ UNIQUE   │     │ UNIQUE   │
└──────────────┘     └──────────┘     └──────────┘
```

- **`external_id`** = Koya `conversion_session.id` or a derived deterministic ID
- Bria enforces uniqueness on `external_id` per payout — safe to retry
- Store `bria_payout_id` in Koya DB after successful submission
- On retry/crash recovery: check if `external_id` already exists before re-submitting

### Configuration

```typescript
// libs/bria-adapter/src/bria-adapter.config.ts
export interface BriaConfig {
  apiUrl: string;      // e.g., 'localhost:2742'
  apiKey: string;      // Profile API key from Bria
  adminUrl: string;    // e.g., 'localhost:2743'
  adminApiKey: string; // Admin API key from bootstrap
  timeoutMs: number;   // gRPC call timeout (default: 10000)
}
```

### Event Streaming (SubscribeAll)

The `SubscribeAll` gRPC stream provides real-time events:

- `utxo_detected` — New deposit received
- `utxo_settled` — Deposit confirmed
- `payout_submitted` — Payout sent to mempool
- `payout_settled` — Payout confirmed on-chain
- `payout_cancelled` — Payout cancelled

Create an event consumer that:
1. Subscribes to Bria's event stream on startup
2. Processes events and updates Koya DB (conversion state machine)
3. Persists `last_sequence` for crash recovery (resume from last processed event)
4. Uses Redis pub/sub to notify real-time WebSocket consumers

---

## Dependencies

- Bria infrastructure running (Dockerfile.bria + docker-compose)
- Bria bootstrapped with admin key
- At least one account and profile created
- xpub imported and wallet created

## Testing Strategy

- **Unit tests:** Mock gRPC client, test service methods and error handling
- **Integration tests:** Require running Bria instance (regtest mode for fast testing)
- **E2E tests:** Full flow — create wallet → generate address → submit payout → verify event

---

## Acceptance Criteria

- [ ] TS gRPC client generated from Bria protos
- [ ] `BriaClientService` can create wallet and generate addresses
- [ ] `BriaClientService` can submit payout with `external_id`
- [ ] Retry with same `external_id` returns existing payout (idempotent)
- [ ] `SubscribeAll` event stream processes events and updates Koya DB
- [ ] Unit tests pass (no Bria required)
- [ ] Integration tests pass (Bria in regtest mode)
