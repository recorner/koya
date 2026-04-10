'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { AssetIcon, BtcIcon } from '@/components/marketing/asset-icons';
import { TICKER_INSTRUMENTS } from '@/components/marketing/asset-metadata';
import { useTickerUpdates } from '@/lib/hooks/use-realtime-rates';

const LOOP_DURATION = 30;

/* ── Standard pair ticker item ─────────────────────────────────── */
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
    <div className="grid min-w-[240px] shrink-0 grid-cols-[22px_68px_1fr_56px] items-center gap-2.5 border-r border-white/6 px-4 py-1.5">
      <AssetIcon symbol={baseSymbol} size={22} />
      <span className="text-[10px] font-semibold tracking-[0.12em] whitespace-nowrap uppercase text-white/45">
        {pair}
      </span>
      <span
        data-ticker-price={pair}
        className="min-w-[80px] text-right font-mono text-[13px] font-semibold tabular-nums text-white/80"
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
        {change || ''}
      </span>
    </div>
  );
}

/* ── Koya BTC buy/sell spread item ─────────────────────────────── */
function KoyaBtcSpreadItem() {
  return (
    <div className="flex shrink-0 items-center gap-4 border-r border-white/6 px-5 py-1.5">
      <BtcIcon size={22} />
      <div className="flex items-center gap-3">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-emerald/70">Koya Buy</p>
          <p
            data-ticker-price="BTC / KES"
            className="font-mono text-[13px] font-semibold tabular-nums text-white/80"
          >
            —
          </p>
        </div>
        <div className="h-5 w-px bg-white/8" />
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-gold/70">Koya Sell</p>
          <p
            data-koya-sell="BTC / KES"
            className="font-mono text-[13px] font-semibold tabular-nums text-white/80"
          >
            —
          </p>
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

export function MarketRibbon({ initialRates }: { initialRates?: RibbonRate[] }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const initialMap = new Map<string, RibbonRate>();
  if (initialRates) {
    for (const r of initialRates) initialMap.set(r.pair, r);
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
            'font-mono text-[10px] font-semibold',
            t.positive ? 'text-emerald' : 'text-red',
          );
        }
      });
      // Update the Koya sell price (slightly lower than market for spread)
      if (t.pair === 'BTC / KES' && t.price) {
        el.querySelectorAll<HTMLSpanElement>('[data-koya-sell="BTC / KES"]').forEach((s) => {
          const raw = parseFloat(t.price.replace(/,/g, ''));
          if (raw > 0) {
            const sell = (raw * 0.985).toLocaleString('en-US', { maximumFractionDigits: 0 });
            if (s.textContent !== sell) s.textContent = sell;
          }
        });
      }
    }
  });

  return (
    <div
      ref={wrapperRef}
      className="relative z-40 overflow-hidden border-b border-white/6 bg-[linear-gradient(180deg,rgba(10,10,12,0.94),rgba(6,6,8,0.98))] backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(212,175,55,0.22),transparent)]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#0a0a0c] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0a0a0c] to-transparent" />

      <div
        className="flex w-max animate-ribbon-scroll py-2"
        style={{ ['--ribbon-duration' as string]: `${LOOP_DURATION}s` }}
      >
        {['a', 'b'].map((key) => (
          <div key={key} className="flex shrink-0 items-center" aria-hidden={key !== 'a'}>
            {/* Koya BTC buy/sell spread — featured first */}
            <KoyaBtcSpreadItem />
            {/* Regular pairs */}
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
