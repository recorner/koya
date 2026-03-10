/** Recognizable asset & brand SVG icons for Koya marketing surfaces.
 *  Crypto tokens: @web3icons/react (official token logos)
 *  Brand/social: @icons-pack/react-simple-icons
 *  Payment rails: local SVG (M-Pesa)
 *  Fiat: custom minimal SVGs (no standard lib available) */

import type React from 'react';
import TokenUSDC from '@web3icons/react/icons/tokens/TokenUSDC';
import { SiApple, SiTesla } from '@icons-pack/react-simple-icons';

interface IconProps {
  size?: number;
  className?: string;
}

/* ─── Re-export M-Pesa from local asset ──────────────────────────── */

export { MpesaIcon } from '@/components/marketing/mpesa-icon';

/* ─── Crypto wrappers (branded variant from @web3icons/react) ────── */

export function BtcIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-label="Bitcoin" role="img">
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path
        d="M22.5 14.1c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.7-.4-.7 2.6c-.4-.1-.9-.2-1.4-.3l.7-2.7-1.7-.4-.7 2.7c-.3-.1-.7-.2-1-.2l-2.3-.6-.4 1.8s1.2.3 1.2.3c.7.2.8.6.8 1l-.8 3.2c0 .1.1.1.1.1h-.1l-1.1 4.5c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.5c.4.1.8.2 1.2.3l-.7 2.8 1.7.4.7-2.7c.5.1.9.2 1.4.3l-.7 2.7 1.7.4.7-2.8c2.8.5 5 .3 5.9-2.2.7-2-.1-3.2-1.5-3.9 1.1-.3 1.9-1 2.1-2.5zm-3.8 5.3c-.5 2-4 .9-5.1.7l.9-3.7c1.1.3 4.7.8 4.2 3zm.5-5.4c-.5 1.8-3.4.9-4.3.7l.8-3.4c1 .2 4 .7 3.5 2.7z"
        fill="white"
      />
    </svg>
  );
}

export function UsdcIcon({ size = 20, className }: IconProps) {
  return <TokenUSDC size={size} className={className} variant="branded" />;
}

export function UsdtIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-label="Tether" role="img">
      <circle cx="16" cy="16" r="16" fill="#50AF95" />
      <path
        d="M17.9 17.1v-.1c-.1 0-.6-.1-1.8-.1s-1.6.1-1.8.1v.1c-3.5.2-6.2.8-6.2 1.5s2.7 1.3 6.2 1.5v-2.4c.2 0 .7.1 1.8.1 1.3 0 1.7-.1 1.8-.1v2.4c3.5-.2 6.1-.8 6.1-1.5s-2.6-1.3-6.1-1.5zm0-1.6V13h4.9v-2.6H9.2V13h4.9v2.5c-4 .2-7 .9-7 1.8s3 1.6 7 1.8v5.3h3.8v-5.3c4-.2 7-.9 7-1.8s-3-1.6-7-1.8z"
        fill="white"
      />
    </svg>
  );
}

/* ─── Fiat (custom — no standard lib) ────────────────────────────── */

export function UsdIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-label="US Dollar" role="img">
      <circle cx="16" cy="16" r="16" fill="#22C55E" />
      <text x="16" y="21.5" textAnchor="middle" fill="white" fontSize="16" fontWeight="700" fontFamily="system-ui">$</text>
    </svg>
  );
}

export function KesIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-label="Kenyan Shilling" role="img">
      <circle cx="16" cy="16" r="16" fill="#10B981" />
      <text x="16" y="20.5" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="system-ui">KSh</text>
    </svg>
  );
}

/* ─── Stock logos ─────────────────────────────────────────────────── */

function StockIconWrapper({
  size = 20,
  className,
  bgColor,
  children,
  label,
}: IconProps & { bgColor: string; children: React.ReactNode; label: string }) {
  return (
    <div
      className={className}
      role="img"
      aria-label={label}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.35,
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

export function AppleIcon({ size = 20, className }: IconProps) {
  return (
    <StockIconWrapper size={size} className={className} bgColor="#1C1C1E" label="Apple">
      <SiApple color="#ffffff" size={size * 0.55} />
    </StockIconWrapper>
  );
}

export function TeslaIcon({ size = 20, className }: IconProps) {
  return (
    <StockIconWrapper size={size} className={className} bgColor="#CC0000" label="Tesla">
      <SiTesla color="#ffffff" size={size * 0.55} />
    </StockIconWrapper>
  );
}

export function MicrosoftIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-label="Microsoft" role="img">
      <circle cx="16" cy="16" r="16" fill="#00A4EF" />
      <rect x="9" y="9" width="6" height="6" fill="#F25022" rx="0.5" />
      <rect x="17" y="9" width="6" height="6" fill="#7FBA00" rx="0.5" />
      <rect x="9" y="17" width="6" height="6" fill="#00A4EF" rx="0.5" />
      <rect x="17" y="17" width="6" height="6" fill="#FFB900" rx="0.5" />
    </svg>
  );
}

export function SpyIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-label="S&P 500 ETF" role="img">
      <circle cx="16" cy="16" r="16" fill="#1B365D" />
      <path d="M8 22 l4-6 3 3 4-8 5 11z" fill="rgba(255,255,255,0.15)" />
      <polyline points="8,22 12,16 15,19 19,11 24,22" fill="none" stroke="#50AF95" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Lookup helpers ─────────────────────────────────────────────── */

const ASSET_ICON_MAP: Record<string, (props: IconProps) => React.JSX.Element> = {
  BTC: BtcIcon,
  USDC: UsdcIcon,
  USDT: UsdtIcon,
  USD: UsdIcon,
  KES: KesIcon,
};

const STOCK_ICON_MAP: Record<string, (props: IconProps) => React.JSX.Element> = {
  AAPL: AppleIcon,
  TSLA: TeslaIcon,
  MSFT: MicrosoftIcon,
  SPY: SpyIcon,
};

export function AssetIcon({ symbol, size = 20, className }: IconProps & { symbol: string }) {
  const Icon = ASSET_ICON_MAP[symbol];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}

export function StockIcon({ symbol, size = 20, className }: IconProps & { symbol: string }) {
  const Icon = STOCK_ICON_MAP[symbol];
  if (!Icon) return null;
  return <Icon size={size} className={className} />;
}
