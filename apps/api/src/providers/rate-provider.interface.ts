/** Rate/quote provider abstraction */
export interface RateProvider {
  /** Get exchange rate for a currency pair */
  getRate(sourceAsset: string, targetAsset: string): Promise<RateResult>;
}

export interface RateResult {
  rate: string;
  spread: string;
  timestamp: Date;
}

export const RATE_PROVIDER = 'RATE_PROVIDER';
