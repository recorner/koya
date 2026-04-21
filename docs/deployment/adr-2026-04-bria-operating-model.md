# ADR-2026-04: Bria Operating Model and BTC Backend Boundary

## Status
Accepted (2026-04-21)

## Decision
Koya will operate Bria as a **private internal AWS service** and consume it through a provider-style BTC backend boundary.

## Context
The previous Bria setup was acceptable for local development and transitional rollout. It was not sufficient as a permanent production model because network posture and ownership boundaries were not explicit enough, and BTC integration remained payout-centric instead of backend-provider centric.

## Final Operating Model
- Bria is deployed by Koya on private ECS compute with private service discovery and private database.
- Bria gRPC is never exposed on a public ingress path.
- Bria remains separately versioned and tracked from upstream releases.
- Koya keeps forks shallow and favors upstream patch/release adoption over deep divergence.

## Ownership Boundary
Koya owns:
- Conversion orchestration and state lifecycle
- Customer notifications and channel delivery
- Reconciliation workflows and reporting
- Backend abstraction (`BtcBackendProvider`) and fallback behavior

Bria owns:
- Wallet/account/address derivation
- UTXO state and payout queue execution
- Internal ledger sequencing and globally ordered execution events

## Network Posture
- Mainnet is the long-term production target.
- testnet4 is supported for testing/UAT/staging via explicit policy mode.
- Koya policy network and Bria runtime network are explicitly paired:
  - `testnet4` policy -> `testnet` Bria runtime
  - `mainnet` policy -> `bitcoin` Bria runtime
- regtest-family behavior is rejected for staging/production.
- Address-family validation is mandatory at deploy time (`tb1...` in testnet4 mode, `bc1...` in mainnet mode).
- If legacy tenant data still emits regtest-family addresses after runtime mapping is corrected, Bria wallet material must be re-provisioned (or tenant/database re-bootstrap performed) before sign-off.

## Non-Goals
- Deep Bria forking
- Public Bria API exposure
- Coupling Koya business logic directly to Bria RPC internals
