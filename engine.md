Goal: Bootstrap Bria admin, create a Koya Bria profile & API key, import a testnet xpub and create an HD wallet, and wire the existing libs/bria-adapter into the ConversionService as BTC_DELIVERY_PROVIDER for the DFNS-managed custody flow. Deliver runnable code, tests, and a short runbook.

Steps:

Prereqs (local/staging)

Ensure Bria container is running and healthy (127.0.0.1:2742 API, 2743 Admin).

Ensure docker/bria.env contains BRIA_ADMIN_API_KEY if bootstrap already performed, or be prepared to call bootstrap().

Bootstrap Admin & create Koya profile

Call BriaAdminService.bootstrap() to create admin credentials if not already present. Save admin admin key to secrets (Secrets Manager).

With admin key, call BriaAdminService.createAccount({ name: 'koya' }) → receive admin/account key(s). Store admin account key in secrets.

Create a service profile: BriaClientService.createProfile('koya-service') and createProfileApiKey() → obtain a profile API key for the adapter. Save as BRIA_API_KEY_KOYA in secrets.

Acceptance check: BriaClientService.createProfileApiKey returns a usable key; calls to createWallet with the key succeed.

Import testnet xpub & create HD wallet

Use BriaClientService.importXpub(profileKey, name, xpub, derivation?) or createWallet with keychain config. For test, use a known testnet xpub (documented in runbook), not production keys.

Verify wallet creation and that newAddress() returns valid testnet addresses.

Broadcast a tiny testnet tx (via QuickNode or faucet) to one of the addresses and validate Bria emits UTXO_DETECTED in journal_events.

Acceptance check: journal_events stream emits UTXO_DETECTED for the tx (or a PAYOUT_SUBMITTED if using Bria payouts).

Wire adapter into ConversionService as BTC_DELIVERY_PROVIDER

Add a provider binding in NestJS that implements existing BtcDeliveryProvider interface (or create one) that delegates to BriaClientService. Implement methods:

reserveAndSubmit(conversion) → create external_id, call DFNS.requestCustodyMove(external_id,…), or call Bria.submitPayout(...) if Bria-managed.

onDfnConfirmed(externalId, dfnsTx) → call Bria’s relevant call (submitSignedPsbt or post settlement utxo_detected) and finalize conversion ledger entries.

subscribeToEvents() → subscribe to BriaClientService.subscribeAll() and map events (PAYOUT_SUBMITTED, UTXO_SETTLED) to Koya conversion states.

Idempotency requirement: Use unique external_id = "koya:conversion:<conversionId>" everywhere; enforce unique constraint in Koya DB (dfns_requests.external_id unique).

Acceptance check: Simulate a full flow:

Reserve funds in Koya ledger.

Call the provider to request custody.

Simulate DFNS confirmation (or have DFNS sandbox reply).

Adapter posts Bria settlement and ConversionService completes conversion.

Verify both Koya ledger and Bria journal show consistent entries.

Tests

Unit tests for the provider with mocked BriaClientService.

Integration smoke: using the running Bria container and a DFNS mock, run a conversion and assert completion and event stream mapping.

Documentation & runbook

Update tasks/bria-adapter-todo.md with exact method mappings and the idempotency contract.

Add a short runbook entry describing how to bootstrap admin, create keys, and run the smoke test.

Deliverables:

Working libs/bria-adapter usage in apps/api ConversionService.

New provider that implements BTC_DELIVERY_PROVIDER.

Unit & e2e smoke tests.

Secrets creation steps and short runbook.

Acceptance criteria:

Successful e2e smoke test against Bria container and DFNS mock within staging.

No production secrets committed; per-service API key stored in Secrets Manager.

PR includes tests, docs, and a note about running the smoke test locally (env needed).