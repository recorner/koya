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

/** Market ticker instruments for the ribbon.
 *  `price` and `change` are placeholder strings shown until the first API fetch completes. */
export interface TickerInstrument {
  pair: string;
  baseSymbol: string;
  quoteSymbol: string;
  price: string;
  change: string;
  positive: boolean;
}

export const TICKER_INSTRUMENTS: TickerInstrument[] = [
  { pair: 'USD / KES', baseSymbol: 'USD', quoteSymbol: 'KES', price: '—', change: '', positive: true },
  { pair: 'KES / USD', baseSymbol: 'KES', quoteSymbol: 'USD', price: '—', change: '', positive: true },
  { pair: 'BTC / KES', baseSymbol: 'BTC', quoteSymbol: 'KES', price: '—', change: '', positive: true },
  { pair: 'BTC / USD', baseSymbol: 'BTC', quoteSymbol: 'USD', price: '—', change: '', positive: true },
  { pair: 'USDC / KES', baseSymbol: 'USDC', quoteSymbol: 'KES', price: '—', change: '', positive: true },
  { pair: 'USDT / KES', baseSymbol: 'USDT', quoteSymbol: 'KES', price: '—', change: '', positive: true },
  { pair: 'USDC / USD', baseSymbol: 'USDC', quoteSymbol: 'USD', price: '—', change: '', positive: true },
  { pair: 'USDT / USD', baseSymbol: 'USDT', quoteSymbol: 'USD', price: '—', change: '', positive: true },
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
