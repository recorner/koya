'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { AssetIcon } from '@/components/marketing/asset-icons';
import { TICKER_INSTRUMENTS } from '@/components/marketing/asset-metadata';
import { useTickerUpdates } from '@/lib/hooks/use-realtime-rates';

function TickerItem({ pair, baseSymbol }: { pair: string; baseSymbol: string }) {
  return (
    <div className="flex shrink-0 items-center gap-3 px-4">
      <AssetIcon symbol={baseSymbol} size={16} />
      <span className="text-xs font-medium text-white-40">{pair}</span>
      <span data-ticker-price={pair} className="font-mono text-xs font-medium text-white-80">—</span>
      <span data-ticker-change={pair} className="font-mono text-[10px] font-semibold text-emerald" />
    </div>
  );
}

export function MarketRibbon() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to ticker updates and patch DOM directly — no re-renders
  useTickerUpdates((tickers) => {
    const el = containerRef.current;
    if (!el) return;
    for (const t of tickers) {
      // Update all matching price spans (both duplicated sets)
      el.querySelectorAll<HTMLSpanElement>(`[data-ticker-price="${t.pair}"]`).forEach((span) => {
        span.textContent = t.price;
      });
      el.querySelectorAll<HTMLSpanElement>(`[data-ticker-change="${t.pair}"]`).forEach((span) => {
        span.textContent = t.change;
        span.className = cn(
          'font-mono text-[10px] font-semibold',
          t.positive ? 'text-emerald' : 'text-red',
        );
      });
    }
  });

  return (
    <div ref={containerRef} className="group relative z-40 bg-cell/80 backdrop-blur-sm overflow-hidden">
      <div className="flex will-change-transform animate-ticker-scroll group-hover:[animation-play-state:paused] py-2.5">
        {/* First set */}
        <div className="flex shrink-0 items-center">
          {TICKER_INSTRUMENTS.map((item) => (
            <TickerItem key={`a-${item.pair}`} pair={item.pair} baseSymbol={item.baseSymbol} />
          ))}
        </div>
        {/* Duplicate for seamless loop */}
        <div className="flex shrink-0 items-center">
          {TICKER_INSTRUMENTS.map((item) => (
            <TickerItem key={`b-${item.pair}`} pair={item.pair} baseSymbol={item.baseSymbol} />
          ))}
        </div>
      </div>
    </div>
  );
}
