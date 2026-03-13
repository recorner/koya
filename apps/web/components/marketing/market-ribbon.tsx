'use client';

import { cn } from '@/lib/utils';
import { AssetIcon } from '@/components/marketing/asset-icons';
import { useRealtimeTickers } from '@/lib/hooks/use-realtime-rates';

function TickerItem({ pair, baseSymbol, price, change, positive }: {
  pair: string;
  baseSymbol: string;
  price: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 px-4">
      <AssetIcon symbol={baseSymbol} size={16} />
      <span className="text-xs font-medium text-white-40">{pair}</span>
      <span className="font-mono text-xs font-medium text-white-80">{price}</span>
      <span
        className={cn(
          'font-mono text-[10px] font-semibold',
          positive ? 'text-emerald' : 'text-red',
        )}
      >
        {change}
      </span>
    </div>
  );
}

export function MarketRibbon() {
  const tickers = useRealtimeTickers();

  return (
    <div className="group relative z-40 bg-cell/80 backdrop-blur-sm overflow-hidden">
      <div className="flex animate-ticker-scroll group-hover:[animation-play-state:paused] py-2.5">
        {/* First set */}
        <div className="flex shrink-0 items-center">
          {tickers.map((item) => (
            <TickerItem key={`a-${item.pair}`} {...item} />
          ))}
        </div>
        {/* Duplicate for seamless loop */}
        <div className="flex shrink-0 items-center">
          {tickers.map((item) => (
            <TickerItem key={`b-${item.pair}`} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}
