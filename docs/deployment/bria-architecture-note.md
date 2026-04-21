# Bria Architecture Note (Koya)

## How Bria Runs Today

- Bria is the custody/payout gRPC daemon that Koya uses for BTC UTXO management, payout batching, and settlement events.
- API delivery can be `bria` or `dfns`, but both rely on Bria eventing and payout primitives.

## What Was Local-Only vs AWS-Ready

- Local-only assumptions included public gRPC exposure in compose defaults and non-enforced network address validation.
- AWS-ready pieces already existed for Secrets Manager mapping and API task secret injection, but Bria compute/network placement was incomplete.

## API Integration Shape

- API submits payouts via Bria providers.
- Final on-chain completion is event-driven (`BriaEventConsumerService`) using durable cursor storage.
- DFNS mode remains available but inactive for this rollout.

## Connection-Refused Root Cause

- API was configured to call Bria via a public/external host path.
- Any upstream reachability drift or endpoint downtime surfaced as `UNAVAILABLE/connection refused`.
- Event stream previously did not auto-reconnect after stream failure.

## Minimum Stable Testnet4 Changes

1. Private AWS-only Bria service discovery (`koya-bria.koya.internal`) and no public Bria ingress.
2. Explicit `BTC_NETWORK=testnet4`, `BRIA_NETWORK=testnet4`, and deterministic address/network validation.
3. Event stream reconnect/backoff with cursor commit only on successful processing.
4. Signer-capable descriptor-based wallet provisioning with secrets sourced from AWS Secrets Manager.
