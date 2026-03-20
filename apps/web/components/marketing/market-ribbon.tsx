'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { AssetIcon } from '@/components/marketing/asset-icons';
import { TICKER_INSTRUMENTS } from '@/components/marketing/asset-metadata';
import { useTickerUpdates } from '@/lib/hooks/use-realtime-rates';

/** Pixels per second. */
const SPEED = 35;

function TickerItem({ pair, baseSymbol }: { pair: string; baseSymbol: string }) {
  return (
    <div className="flex shrink-0 items-center gap-3 px-5">
      <AssetIcon symbol={baseSymbol} size={16} />
      <span className="text-xs font-medium text-white-40">{pair}</span>
      <span data-ticker-price={pair} className="font-mono text-xs font-medium text-white-80">—</span>
      <span data-ticker-change={pair} className="font-mono text-[10px] font-semibold text-emerald" />
    </div>
  );
}

export function MarketRibbon() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const rafRef = useRef(0);
  const prevRef = useRef(0);
  const pausedRef = useRef(false);
  const widthRef = useRef(0);

  /* ── animation loop ──────────────────────────────────────────── */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Observe the first set to get its pixel width without forcing layout.
    const firstSet = track.children[0] as HTMLElement;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) widthRef.current = entry.contentRect.width;
    });
    ro.observe(firstSet);

    const frame = (t: number) => {
      if (prevRef.current && !pausedRef.current && widthRef.current > 0) {
        const dt = (t - prevRef.current) / 1000;
        xRef.current = (xRef.current + SPEED * dt) % widthRef.current;
        track.style.transform = `translate3d(${-xRef.current}px,0,0)`;
      }
      prevRef.current = t;
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);

  /* ── price updates (DOM-only, no React re-render, no layout read) ─ */
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
    }
  });

  return (
    <div
      ref={wrapperRef}
      className="relative z-40 bg-cell/80 backdrop-blur-sm overflow-hidden"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div
        ref={trackRef}
        className="flex will-change-transform py-2.5"
        style={{ transform: 'translate3d(0,0,0)' }}
      >
        <div className="flex shrink-0 items-center">
          {TICKER_INSTRUMENTS.map((item) => (
            <TickerItem key={`a-${item.pair}`} pair={item.pair} baseSymbol={item.baseSymbol} />
          ))}
        </div>
        <div className="flex shrink-0 items-center">
          {TICKER_INSTRUMENTS.map((item) => (
            <TickerItem key={`b-${item.pair}`} pair={item.pair} baseSymbol={item.baseSymbol} />
          ))}
        </div>
      </div>
    </div>
  );
}
