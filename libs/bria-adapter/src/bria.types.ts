import * as grpc from '@grpc/grpc-js';

/** Bria adapter configuration */
export interface BriaConfig {
  apiHost: string;
  apiPort: number;
  adminHost: string;
  adminPort: number;
  apiKey: string;
  adminApiKey: string;
  timeoutMs: number;
}

// ─── Profile ───────────────────────────────────────────────

export interface CreateProfileInput {
  name: string;
  spendingPolicy?: SpendingPolicy;
}

export interface SpendingPolicy {
  allowedPayoutAddresses?: string[];
  maxPayoutSats?: number;
}

export interface CreateProfileResult {
  id: string;
}

export interface CreateProfileApiKeyResult {
  id: string;
  key: string;
}

export interface ProfileInfo {
  id: string;
  name: string;
  spendingPolicy?: SpendingPolicy;
}

// ─── Xpub ──────────────────────────────────────────────────

export interface ImportXpubInput {
  name: string;
  xpub: string;
  derivation: string;
}

export interface ImportXpubResult {
  id: string;
}

// ─── Wallet ────────────────────────────────────────────────

export interface KeychainConfig {
  wpkh?: { xpub: string; derivationPath?: string };
  descriptors?: { external: string; internal: string };
  sortedMultisig?: { xpubs: string[]; threshold: number };
}

export interface CreateWalletInput {
  name: string;
  keychainConfig: KeychainConfig;
}

export interface CreateWalletResult {
  id: string;
  xpubIds: string[];
}

export interface WalletBalanceSummary {
  effectivePendingIncome: number;
  effectiveSettled: number;
  effectivePendingOutgoing: number;
  effectiveEncumberedOutgoing: number;
  utxoEncumberedIncoming: number;
  utxoPendingIncoming: number;
  utxoSettled: number;
  utxoPendingOutgoing: number;
  feesPending: number;
  feesEncumbered: number;
}

// ─── Address ───────────────────────────────────────────────

export interface NewAddressInput {
  walletName: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface NewAddressResult {
  address: string;
}

// ─── Payout ────────────────────────────────────────────────

export interface SubmitPayoutInput {
  walletName: string;
  payoutQueueName: string;
  destination: { onchainAddress: string } | { destinationWalletName: string };
  satoshis: number;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface SubmitPayoutResult {
  id: string;
  batchInclusionEstimatedAt?: number;
}

export interface EstimatePayoutFeeInput {
  walletName: string;
  payoutQueueName: string;
  destination: { onchainAddress: string } | { destinationWalletName: string };
  satoshis: number;
}

export interface EstimatePayoutFeeResult {
  satoshis: number;
}

export interface PayoutInfo {
  id: string;
  walletId: string;
  payoutQueueId: string;
  batchId?: string;
  satoshis: number;
  onchainAddress?: string;
  cancelled: boolean;
  externalId: string;
  metadata?: Record<string, unknown>;
  txId?: string;
  vout?: number;
}

export interface GetPayoutInput {
  id?: string;
  externalId?: string;
}

// ─── Batch / Signing ───────────────────────────────────────

export interface GetBatchResult {
  id: string;
  payoutQueueId: string;
  txId: string;
  unsignedPsbt: string;
  signingSessions: Array<{
    id: string;
    batchId: string;
    xpubId: string;
    state: string;
    failureReason?: string;
  }>;
}

export interface SubmitSignedPsbtInput {
  batchId: string;
  xpubRef: string;
  signedPsbt: string;
}

// ─── Events (SubscribeAll) ─────────────────────────────────

export interface SubscribeAllInput {
  afterSequence?: number;
  augment?: boolean;
}

export type BriaEventPayload =
  | { type: 'utxo_detected'; data: UtxoEvent }
  | { type: 'utxo_settled'; data: UtxoSettledEvent }
  | { type: 'utxo_dropped'; data: UtxoEvent }
  | { type: 'payout_submitted'; data: PayoutEvent }
  | { type: 'payout_cancelled'; data: PayoutEvent }
  | { type: 'payout_committed'; data: PayoutCommittedEvent }
  | { type: 'payout_broadcast'; data: PayoutCommittedEvent }
  | { type: 'payout_settled'; data: PayoutCommittedEvent };

export interface BriaEvent {
  sequence: number;
  recordedAt: number;
  payload: BriaEventPayload;
}

export interface UtxoEvent {
  walletId: string;
  txId: string;
  vout: number;
  satoshis: number;
  address: string;
}

export interface UtxoSettledEvent extends UtxoEvent {
  blockHeight: number;
  blockTime: number;
}

export interface PayoutEvent {
  id: string;
  walletId: string;
  payoutQueueId: string;
  satoshis: number;
  onchainAddress?: string;
}

export interface PayoutCommittedEvent extends PayoutEvent {
  txId: string;
  vout: number;
  proportionalFeeSats: number;
}

// ─── Admin ─────────────────────────────────────────────────

export interface BootstrapResult {
  id: string;
  name: string;
  key: string;
}

export interface CreateAccountResult {
  profileId: string;
  name: string;
  key: string;
  accountId: string;
}

export interface AccountInfo {
  id: string;
  name: string;
}

// ─── gRPC client types (dynamic proto-loader) ──────────────

export type GrpcClient = grpc.Client;
