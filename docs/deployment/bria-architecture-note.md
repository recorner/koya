# Bria Architecture Note (Finalized)

## Scope of Previous Setup
The previous Bria setup was acceptable for local/dev and transitional rollout. It is not the permanent production model.

## Final Model
- Bria is a Koya-operated private AWS service (ECS + private service discovery + private DB).
- Koya consumes Bria through a provider-style BTC backend boundary.
- Bria remains an upstream-tracked custody engine with shallow local patches only.

## Responsibilities
- Koya: orchestration, lifecycle transitions, reconciliation, customer notifications, provider abstraction.
- Bria: wallet/address management, UTXO tracking, payout queue execution, event sequencing.

## Network Policy
- mainnet is the long-term production target.
- testnet4 is supported for test/UAT/staging.
- Runtime mapping is explicit:
  - Koya `BTC_NETWORK=testnet4` -> Bria `BRIA_NETWORK=testnet`
  - Koya `BTC_NETWORK=bitcoin` -> Bria `BRIA_NETWORK=bitcoin`

## Root Cause and Resolution Status
Primary code/config root cause was addressed:
- Bria config schema mismatch (top-level `blockchain` instead of `app.blockchain`) and
- unsupported literal `testnet4` runtime enum in Bria 0.1.131.

Residual runtime blocker can still exist in long-lived tenants:
- legacy regtest-era wallet material in Bria can continue emitting `bcrt1...` even after runtime mapping is corrected to `testnet`.
- creating a replacement wallet from the same descriptor can fail with `DescriptorAlreadyInUse`.

Final policy:
- deployment must pass address-family validation (`tb1...` in testnet4 mode) before sign-off.
- if validation fails, re-provision fresh wallet material or re-bootstrap on a fresh Bria tenant/database.
