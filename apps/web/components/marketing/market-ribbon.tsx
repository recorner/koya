'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { AssetIcon, BtcIcon } from '@/components/marketing/asset-icons';
import { TICKER_INSTRUMENTS } from '@/components/marketing/asset-metadata';
import { useTickerUpdates } from '@/lib/hooks/use-realtime-rates';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

const LOOP_DURATION = 34;

function TickerItem({
  pair,
  baseSymbol,
  price,
  change,
  positive,
}: {
  pair: string;
  baseSymbol: string;
  price?: string;
  change?: string;
  positive?: boolean;
}) {
  return (
    <div className="grid min-w-[250px] shrink-0 grid-cols-[20px_70px_1fr_52px] items-center gap-2 border-r border-white/10 px-4 py-1.5">
      <AssetIcon symbol={baseSymbol} size={18} />
      <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-white/45">{pair}</span>
      <span
        data-ticker-price={pair}
        className="text-right font-mono text-[12px] font-semibold tabular-nums text-white/88"
      >
        {price || '—'}
      </span>
      <span
        data-ticker-change={pair}
        className={cn(
          'text-right font-mono text-[10px] font-semibold tabular-nums',
          positive === false ? 'text-red' : 'text-emerald',
        )}
      >
        {change || '0.00%'}
      </span>
    </div>
  );
}

function KoyaBtcSpreadItem() {
  return (
    <div className="flex shrink-0 items-center gap-4 border-r border-white/10 px-5 py-1.5">
      <BtcIcon size={18} />
      <div>
        <p className="text-[9px] font-medium tracking-[0.14em] uppercase text-white/45">BTC / KES Desk</p>
        <div className="mt-0.5 flex items-center gap-3">
          <span className="text-[9px] uppercase tracking-[0.14em] text-emerald/80">Bid</span>
          <span data-ticker-price="BTC / KES" className="font-mono text-[12px] font-semibold tabular-nums text-white/88">
            —
          </span>
          <span className="h-3 w-px bg-white/12" />
          <span className="text-[9px] uppercase tracking-[0.14em] text-gold/90">Ask</span>
          <span data-koya-sell="BTC / KES" className="font-mono text-[12px] font-semibold tabular-nums text-white/88">
            —
          </span>
        </div>
      </div>
    </div>
  );
}

export interface RibbonRate {
  pair: string;
  price: string;
  change: string;
  positive: boolean;
}

export function MarketRibbon({
  initialRates,
  content,
}: {
  initialRates?: RibbonRate[];
  content?: MarketingSectionContent;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const initialMap = new Map<string, RibbonRate>();
  if (initialRates) {
    for (const rate of initialRates) initialMap.set(rate.pair, rate);
  }

  useTickerUpdates((tickers) => {
    const el = wrapperRef.current;
    if (!el) return;

    for (const t of tickers) {
      el.querySelectorAll<HTMLSpanElement>(`[data-ticker-price="${t.pair}"]`).forEach((s) => {
        if (s.textContent !== t.price) s.textContent = t.price;
      });

      el.querySelectorAll<HTMLSpanElement>(`[data-ticker-change="${t.pair}"]`).forEach((s) => {
        if (s.textContent !== t.change) {
          s.textContent = t.change;
          s.className = cn(
            'text-right font-mono text-[10px] font-semibold tabular-nums',
            t.positive ? 'text-emerald' : 'text-red',
          );
        }
      });

      if (t.pair === 'BTC / KES' && t.price) {
        el.querySelectorAll<HTMLSpanElement>('[data-koya-sell="BTC / KES"]').forEach((s) => {
          const raw = parseFloat(t.price.replace(/,/g, ''));
          if (raw > 0) {
            const ask = (raw * 0.985).toLocaleString('en-US', { maximumFractionDigits: 0 });
            if (s.textContent !== ask) s.textContent = ask;
          }
        });
      }
    }
  });

  return (
    <div ref={wrapperRef} className="relative z-40 overflow-hidden border-b border-white/10 bg-[#0d0d0d]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#0d0d0d] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0d0d0d] to-transparent" />
      <div className="mx-auto flex max-w-7xl items-center gap-3 border-b border-white/8 px-4 py-1 sm:px-6 lg:px-10">
        <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-gold">
          {content?.badge || 'Live Market Snapshot'}
        </span>
      </div>
      <div className="flex w-max animate-ribbon-scroll py-1.5" style={{ ['--ribbon-duration' as string]: `${LOOP_DURATION}s` }}>
        {['a', 'b'].map((key) => (
          <div key={key} className="flex shrink-0 items-center" aria-hidden={key !== 'a'}>
            <KoyaBtcSpreadItem />
            {TICKER_INSTRUMENTS.map((item) => {
              const initial = initialMap.get(item.pair);
              return (
                <TickerItem
                  key={`${key}-${item.pair}`}
                  pair={item.pair}
                  baseSymbol={item.baseSymbol}
                  price={initial?.price}
                  change={initial?.change}
                  positive={initial?.positive}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
