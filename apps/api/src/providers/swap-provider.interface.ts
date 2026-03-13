/** Swap/exchange execution abstraction */
export interface SwapProvider {
  /** Execute a conversion between two assets */
  executeSwap(input: SwapInput): Promise<SwapResult>;
}

export interface SwapInput {
  sourceAsset: string;
  targetAsset: string;
  sourceAmountMinor: bigint;
  rate: string;
  referenceCode: string;
}

export interface SwapResult {
  success: boolean;
  /** Net target amount received (in minor units) */
  targetAmountMinor: bigint;
  /** Provider-side execution ID */
  executionId: string;
  /** Settled rate (may differ slightly from quoted rate) */
  settledRate: string;
  /** ISO timestamp of execution */
  executedAt: Date;
  /** Reason for failure (if !success) */
  reason?: string;
}

export const SWAP_PROVIDER = 'SWAP_PROVIDER';
