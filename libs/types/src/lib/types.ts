/** Supported currencies in the Koya platform */
export enum Currency {
  KES = 'KES',
  USD = 'USD',
  BTC = 'BTC',
  USDC = 'USDC',
  USDT = 'USDT',
}

/** Standard API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
}

/** KYC verification tiers */
export enum KycTier {
  GUEST = 'guest',
  STANDARD = 'standard',
  PREMIUM = 'premium',
}

/** User account status */
export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  FROZEN = 'frozen',
  CLOSED = 'closed',
}
