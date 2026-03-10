'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpDown, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AssetIcon, MpesaIcon } from '@/components/marketing/asset-icons';
import { ASSETS, ASSET_LIST, MOCK_RATES, type Asset } from '@/components/marketing/asset-metadata';

/* ─── Swap state hook ──────────────────────────────────────────── */

function useSwapState() {
  const [sourceSymbol, setSourceSymbol] = useState('KES');
  const [destSymbol, setDestSymbol] = useState('BTC');
  const [sourceAmount, setSourceAmount] = useState('');

  const source = ASSETS[sourceSymbol]!;
  const dest = ASSETS[destSymbol]!;
  const rate = MOCK_RATES[sourceSymbol]?.[destSymbol] ?? 0;

  const destAmount = useMemo(() => {
    const val = parseFloat(sourceAmount.replace(/,/g, ''));
    if (!val || val <= 0 || !rate) return '';
    const result = val * rate;
    // Format with appropriate decimals based on asset type
    if (dest.type === 'crypto') return result.toFixed(8);
    if (dest.type === 'stablecoin') return result.toFixed(2);
    return result.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }, [sourceAmount, rate, dest.type]);

  const rateDisplay = useMemo(() => {
    if (!rate) return '';
    const formatted = rate < 0.001
      ? rate.toFixed(8)
      : rate.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return `1 ${sourceSymbol} ≈ ${formatted} ${destSymbol}`;
  }, [rate, sourceSymbol, destSymbol]);

  const swapDirection = useCallback(() => {
    setSourceSymbol(destSymbol);
    setDestSymbol(sourceSymbol);
    setSourceAmount('');
  }, [sourceSymbol, destSymbol]);

  const updateSource = useCallback((symbol: string) => {
    if (symbol === destSymbol) setDestSymbol(sourceSymbol);
    setSourceSymbol(symbol);
    setSourceAmount('');
  }, [destSymbol, sourceSymbol]);

  const updateDest = useCallback((symbol: string) => {
    if (symbol === sourceSymbol) setSourceSymbol(destSymbol);
    setDestSymbol(symbol);
  }, [sourceSymbol, destSymbol]);

  return {
    source, dest, sourceAmount, destAmount,
    rate, rateDisplay,
    setSourceAmount, swapDirection,
    updateSource, updateDest,
  };
}

/* ─── Asset selector dropdown ──────────────────────────────────── */

function AssetSelector({
  selected,
  onSelect,
  exclude,
}: {
  selected: Asset;
  onSelect: (symbol: string) => void;
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-white-10 bg-white-5 px-3 py-2 transition-colors hover:bg-white-10"
      >
        <AssetIcon symbol={selected.symbol} size={20} />
        <span className="font-mono text-sm font-semibold text-white-95">
          {selected.symbol}
        </span>
        <ChevronDown size={14} className={cn('text-white-40 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 z-50 mt-1 min-w-[160px] rounded-xl border border-white-10 bg-cell/95 p-1.5 shadow-glass backdrop-blur-xl"
          >
            {ASSET_LIST.filter((a) => a.symbol !== exclude).map((asset) => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => { onSelect(asset.symbol); setOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white-5',
                  asset.symbol === selected.symbol && 'bg-white-5',
                )}
              >
                <AssetIcon symbol={asset.symbol} size={18} />
                <div>
                  <p className="font-mono text-sm font-medium text-white-95">{asset.symbol}</p>
                  <p className="text-[11px] text-white-40">{asset.name}</p>
                </div>
                {asset.symbol === 'KES' && (
                  <MpesaIcon size={14} className="ml-auto opacity-50" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main swap widget ─────────────────────────────────────────── */

export function GuestSwapWidget() {
  const {
    source, dest, sourceAmount, destAmount,
    rateDisplay, setSourceAmount, swapDirection,
    updateSource, updateDest,
  } = useSwapState();

  const [rotations, setRotations] = useState(0);
  const hasAmount = sourceAmount.length > 0 && parseFloat(sourceAmount.replace(/,/g, '')) > 0;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="glass rounded-2xl p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-white-95">Convert</h3>
          <span className="rounded-full border border-gold/20 bg-gold/5 px-3 py-0.5 font-mono text-[10px] font-semibold text-gold">
            Guest Preview
          </span>
        </div>

        {/* Source panel */}
        <div className="rounded-xl border border-white-5 bg-white-5/30 p-4">
          <p className="mb-2 text-[11px] font-medium tracking-wider uppercase text-white-40">
            You pay
          </p>
          <div className="flex items-center gap-3">
            <AssetSelector
              selected={source}
              onSelect={updateSource}
              exclude={dest.symbol}
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={sourceAmount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.,]/g, '');
                setSourceAmount(v);
              }}
              className="w-full min-w-0 text-right font-mono text-xl font-medium text-white-95 placeholder:text-white-20 bg-transparent border-none outline-none focus:outline-none"
            />
          </div>
          {source.symbol === 'KES' && (
            <div className="mt-2 flex items-center gap-1.5">
              <MpesaIcon size={12} />
              <span className="text-[10px] text-white-30">via M-Pesa</span>
            </div>
          )}
        </div>

        {/* Swap toggle */}
        <div className="relative z-10 flex justify-center -my-3">
          <motion.button
            type="button"
            onClick={() => { swapDirection(); setRotations((r) => r + 1); }}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white-10 bg-cell shadow-glass transition-colors hover:bg-surface-raised"
            animate={{ rotate: rotations * 180 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <ArrowUpDown size={16} className="text-gold" />
          </motion.button>
        </div>

        {/* Destination panel */}
        <div className="rounded-xl border border-white-5 bg-white-5/30 p-4">
          <p className="mb-2 text-[11px] font-medium tracking-wider uppercase text-white-40">
            You receive
          </p>
          <div className="flex items-center gap-3">
            <AssetSelector
              selected={dest}
              onSelect={updateDest}
              exclude={source.symbol}
            />
            <div className="w-full min-w-0 text-right font-mono text-xl font-medium text-white-95">
              {destAmount || (
                <span className="text-white-20">0.00</span>
              )}
            </div>
          </div>
        </div>

        {/* Rate display */}
        {rateDisplay && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-white-5/30 py-2">
            <span className="font-mono text-xs text-white-40">{rateDisplay}</span>
          </div>
        )}

        {/* CTA */}
        <Button
          size="lg"
          className="mt-5 w-full text-base"
          disabled={!hasAmount}
        >
          {hasAmount ? 'Get Started to Convert' : 'Enter an amount'}
        </Button>

        {/* Disclaimer */}
        <p className="mt-3 text-center text-[10px] leading-relaxed text-white-20">
          Rates shown are indicative. Sign up for live quotes and instant execution.
        </p>
      </div>
    </div>
  );
}
