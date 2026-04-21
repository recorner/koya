export interface BtcBackendProvider {
  readonly backend: string;

  generateDepositAddress(input: BtcGenerateDepositAddressInput): Promise<BtcGenerateDepositAddressResult>;
  submitPayout(input: BtcSubmitPayoutInput): Promise<BtcSubmitPayoutResult>;
  getPayout(input: BtcGetPayoutInput): Promise<BtcGetPayoutResult | null>;
  classifyError(error: unknown): BtcBackendErrorClassification;
  healthMetadata(): BtcBackendHealthMetadata;
  capabilities(): BtcBackendCapability[];
}

export type BtcBackendCapability =
  | 'deposit_address_generation'
  | 'payout_submission'
  | 'payout_lookup'
  | 'event_stream';

export interface BtcGenerateDepositAddressInput {
  walletName?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface BtcGenerateDepositAddressResult {
  address: string;
  externalId?: string;
}

export interface BtcSubmitPayoutInput {
  address: string;
  amountSatoshis: bigint;
  referenceCode: string;
  metadata?: Record<string, unknown>;
}

export interface BtcSubmitPayoutResult {
  providerPayoutId: string;
  txId?: string;
}

export interface BtcGetPayoutInput {
  id?: string;
  externalId?: string;
}

export interface BtcGetPayoutResult {
  id: string;
  externalId?: string;
  txId?: string;
  cancelled: boolean;
}

export interface BtcBackendErrorClassification {
  retryable: boolean;
  reason: string;
  suggestedDelayMs?: number;
}

export interface BtcBackendHealthMetadata {
  backend: string;
  healthy: boolean;
  capabilities: BtcBackendCapability[];
  network?: string;
  walletName?: string;
  payoutQueueName?: string;
}

export const BTC_BACKEND_PROVIDER = 'BTC_BACKEND_PROVIDER';
