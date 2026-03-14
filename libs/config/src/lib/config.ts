import { Currency } from '@koya/types';

export const APP_NAME = 'Koya';
export const APP_TAGLINE = 'Borderless Finance';
export const APP_DESCRIPTION =
  'The borderless financial operating system. Convert, hold, and move money across currencies and borders.';

export const SUPPORTED_CURRENCIES = [
  Currency.KES,
  Currency.USD,
  Currency.BTC,
  Currency.USDC,
  Currency.USDT,
] as const;

export const CURRENCY_CONFIG = {
  [Currency.KES]: { name: 'Kenyan Shilling', symbol: 'KES', decimals: 2, type: 'fiat' as const },
  [Currency.USD]: { name: 'US Dollar', symbol: '$', decimals: 2, type: 'fiat' as const },
  [Currency.BTC]: { name: 'Bitcoin', symbol: '₿', decimals: 8, type: 'crypto' as const },
  [Currency.USDC]: { name: 'USD Coin', symbol: 'USDC', decimals: 6, type: 'stablecoin' as const },
  [Currency.USDT]: { name: 'Tether', symbol: 'USDT', decimals: 6, type: 'stablecoin' as const },
};

export const API_BASE_URL =
  process.env['NEXT_PUBLIC_API_URL'] ?? 'https://koya.olesereni.site/api/v1';
