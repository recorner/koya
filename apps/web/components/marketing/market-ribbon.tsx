'use client';

import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AssetIcon } from '@/components/marketing/asset-icons';
import { TICKER_INSTRUMENTS } from '@/components/marketing/asset-metadata';
import { useTickerUpdates } from '@/lib/hooks/use-realtime-rates';

/** Pixels per second — Binance-style smooth constant speed. */
const SCROLL_SPEED = 40;

function TickerItem({ pair, baseSymbol }: { pair: string; baseSymbol: string }) {
  return (
    <div className="flex shrink-0 items-center gap-3 px-5">
      <AssetIcon symbol={baseSymbol} size={16} />
      <span className="text-xs font-medium text-white-40">{pair}</span>
      <span data-ticker-price={pair} className="font-mono text-xs font-medium text-white-80 transition-colors duration-300">—</span>
      <span data-ticker-change={pair} className="font-mono text-[10px] font-semibold text-emerald transition-colors duration-300" />
    </div>
  );
}

export function MarketRibbon() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const hoveredRef = useRef(false);
  /** Width of one ticker set (first half). Measured dynamically. */
  const halfWidthRef = useRef(0);

  // Measure the width of the first set of tickers
  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const firstSet = track.children[0] as HTMLElement | undefined;
    if (firstSet) halfWidthRef.current = firstSet.offsetWidth;
  }, []);

  // rAF scroll loop — runs continuously, no CSS animation, no restart
  useEffect(() => {
    measure();

    const onResize = () => measure();
    window.addEventListener('resize', onResize);

    const tick = (time: number) => {
      if (lastTimeRef.current) {
        const dt = (time - lastTimeRef.current) / 1000;
        if (!hoveredRef.current && halfWidthRef.current > 0) {
          offsetRef.current += SCROLL_SPEED * dt;
          // Seamless wrap: when first set fully scrolls off, reset
          if (offsetRef.current >= halfWidthRef.current) {
            offsetRef.current -= halfWidthRef.current;
          }
          if (trackRef.current) {
            trackRef.current.style.transform = `translate3d(${-offsetRef.current}px,0,0)`;
          }
        }
      }
      lastTimeRef.current = time;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [measure]);

  // Subscribe to SSE ticker updates — patch DOM directly, zero re-renders
  useTickerUpdates((tickers) => {
    const el = wrapperRef.current;
    if (!el) return;
    for (const t of tickers) {
      el.querySelectorAll<HTMLSpanElement>(`[data-ticker-price="${t.pair}"]`).forEach((span) => {
        if (span.textContent !== t.price) span.textContent = t.price;
      });
      el.querySelectorAll<HTMLSpanElement>(`[data-ticker-change="${t.pair}"]`).forEach((span) => {
        if (span.textContent !== t.change) {
          span.textContent = t.change;
          span.className = cn(
            'font-mono text-[10px] font-semibold transition-colors duration-300',
            t.positive ? 'text-emerald' : 'text-red',
          );
        }
      });
    }
    // Re-measure in case price text changed widths
    measure();
  });

  return (
    <div
      ref={wrapperRef}
      className="group relative z-40 bg-cell/80 backdrop-blur-sm overflow-hidden"
      onMouseEnter={() => { hoveredRef.current = true; }}
      onMouseLeave={() => { hoveredRef.current = false; }}
    >
      <div ref={trackRef} className="flex will-change-transform py-2.5" style={{ transform: 'translate3d(0,0,0)' }}>
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
