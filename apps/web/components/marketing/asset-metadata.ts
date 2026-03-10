/** Asset types and metadata registry for Koya marketing surfaces.
 *  Structured so it can later be replaced with real API data. */

export type AssetType = 'fiat' | 'crypto' | 'stablecoin';

export interface Asset {
  symbol: string;
  name: string;
  type: AssetType;
  /** Accent color used for icon tinting */
  color: string;
  /** Short symbol shown in compact UI (e.g. "₿") */
  glyph?: string;
}

export const ASSETS: Record<string, Asset> = {
  KES: { symbol: 'KES', name: 'Kenyan Shilling', type: 'fiat', color: '#10B981', glyph: 'KSh' },
  USD: { symbol: 'USD', name: 'US Dollar', type: 'fiat', color: '#22C55E', glyph: '$' },
  BTC: { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', color: '#F7931A', glyph: '₿' },
  USDC: { symbol: 'USDC', name: 'USD Coin', type: 'stablecoin', color: '#2775CA', glyph: '$' },
  USDT: { symbol: 'USDT', name: 'Tether', type: 'stablecoin', color: '#50AF95', glyph: '₮' },
};

export const ASSET_LIST = Object.values(ASSETS);

/** Swap pairs with mock indicative rates (source → dest).
 *  Rates are illustrative for the guest widget — will be replaced with live quotes. */
export const MOCK_RATES: Record<string, Record<string, number>> = {
  KES: { USD: 0.0077, BTC: 0.0000000881, USDC: 0.0077, USDT: 0.0077 },
  USD: { KES: 129.85, BTC: 0.00001143, USDC: 1.0001, USDT: 1.0002 },
  BTC: { KES: 11_352_978, USD: 87_432.1, USDC: 87_430, USDT: 87_435 },
  USDC: { KES: 129.83, USD: 0.9999, BTC: 0.00001143, USDT: 1.0001 },
  USDT: { KES: 129.82, USD: 0.9998, BTC: 0.00001143, USDC: 0.9999 },
};

/** Market ticker instruments for the ribbon. */
export interface TickerInstrument {
  pair: string;
  baseSymbol: string;
  quoteSymbol: string;
  price: string;
  change: string;
  positive: boolean;
}

export const TICKER_INSTRUMENTS: TickerInstrument[] = [
  { pair: 'KES / USD', baseSymbol: 'KES', quoteSymbol: 'USD', price: '0.00770', change: '+0.12%', positive: true },
  { pair: 'USD / KES', baseSymbol: 'USD', quoteSymbol: 'KES', price: '129.85', change: '-0.12%', positive: false },
  { pair: 'BTC / USD', baseSymbol: 'BTC', quoteSymbol: 'USD', price: '87,432.10', change: '+2.34%', positive: true },
  { pair: 'BTC / KES', baseSymbol: 'BTC', quoteSymbol: 'KES', price: '11,352,978', change: '+2.21%', positive: true },
  { pair: 'USDC / USD', baseSymbol: 'USDC', quoteSymbol: 'USD', price: '1.0001', change: '+0.01%', positive: true },
  { pair: 'USDT / USD', baseSymbol: 'USDT', quoteSymbol: 'USD', price: '1.0002', change: '+0.02%', positive: true },
  { pair: 'USDC / KES', baseSymbol: 'USDC', quoteSymbol: 'KES', price: '129.83', change: '+0.10%', positive: true },
  { pair: 'USDT / KES', baseSymbol: 'USDT', quoteSymbol: 'KES', price: '129.82', change: '+0.09%', positive: true },
];

/** Stock tickers for the global investing section. */
export interface StockTicker {
  symbol: string;
  name: string;
  price: string;
  change: string;
  positive: boolean;
}

export const STOCK_TICKERS: StockTicker[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: '237.42', change: '+1.24%', positive: true },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: '278.91', change: '-0.87%', positive: false },
  { symbol: 'SPY', name: 'S&P 500 ETF', price: '584.16', change: '+0.52%', positive: true },
  { symbol: 'MSFT', name: 'Microsoft', price: '428.53', change: '+0.91%', positive: true },
];
