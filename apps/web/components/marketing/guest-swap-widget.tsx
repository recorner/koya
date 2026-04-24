'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpDown, ChevronDown, Dot, ShieldCheck, Zap } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AssetIcon, MpesaIcon } from '@/components/marketing/asset-icons';
import { ASSETS, ASSET_LIST, type Asset } from '@/components/marketing/asset-metadata';
import { useRealtimeRates } from '@/lib/hooks/use-realtime-rates';

function useSwapState() {
  const [sourceSymbol, setSourceSymbol] = useState('KES');
  const [destSymbol, setDestSymbol] = useState('BTC');
  const [sourceAmount, setSourceAmount] = useState('');

  const liveRates = useRealtimeRates();

  const source = ASSETS[sourceSymbol] as NonNullable<(typeof ASSETS)[string]>;
  const dest = ASSETS[destSymbol] as NonNullable<(typeof ASSETS)[string]>;
  const rate = liveRates[sourceSymbol]?.[destSymbol] ?? 0;

  const numericSourceAmount = useMemo(() => {
    const val = parseFloat(sourceAmount.replace(/,/g, ''));
    return !val || val <= 0 ? 0 : val;
  }, [sourceAmount]);

  const destAmount = useMemo(() => {
    if (!numericSourceAmount || !rate) return '';
    const result = numericSourceAmount * rate;

    if (dest.type === 'crypto') return result.toFixed(8);
    if (dest.type === 'stablecoin') return result.toFixed(2);

    return result.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }, [numericSourceAmount, rate, dest.type]);

  const rateDisplay = useMemo(() => {
    if (!rate) return '';
    if (rate < 0.01) {
      const inverted = 1 / rate;
      const formatted = inverted.toLocaleString('en-US', { maximumFractionDigits: 2 });
      return `1 ${destSymbol} ≈ ${formatted} ${sourceSymbol}`;
    }
    const formatted = rate.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return `1 ${sourceSymbol} ≈ ${formatted} ${destSymbol}`;
  }, [rate, sourceSymbol, destSymbol]);

  const swapDirection = useCallback(() => {
    setSourceSymbol(destSymbol);
    setDestSymbol(sourceSymbol);
    setSourceAmount('');
  }, [sourceSymbol, destSymbol]);

  const updateSource = useCallback(
    (symbol: string) => {
      if (symbol === destSymbol) setDestSymbol(sourceSymbol);
      setSourceSymbol(symbol);
      setSourceAmount('');
    },
    [destSymbol, sourceSymbol],
  );

  const updateDest = useCallback(
    (symbol: string) => {
      if (symbol === sourceSymbol) setSourceSymbol(destSymbol);
      setDestSymbol(symbol);
    },
    [sourceSymbol, destSymbol],
  );

  return {
    source,
    dest,
    sourceAmount,
    numericSourceAmount,
    destAmount,
    rateDisplay,
    setSourceAmount,
    swapDirection,
    updateSource,
    updateDest,
  };
}

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
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-white/14 bg-[#0f0f0f] px-3 py-2"
      >
        <AssetIcon symbol={selected.symbol} size={18} />
        <span className="font-mono text-sm text-white/90">{selected.symbol}</span>
        <ChevronDown size={14} className={cn('text-white/44 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 z-50 mt-2 min-w-[190px] rounded-md border border-white/14 bg-[#101010] p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
          >
            {ASSET_LIST.filter((a) => a.symbol !== exclude).map((asset) => (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => {
                  onSelect(asset.symbol);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/[0.04]',
                  asset.symbol === selected.symbol && 'bg-white/[0.05]',
                )}
              >
                <AssetIcon symbol={asset.symbol} size={18} />
                <div>
                  <p className="font-mono text-sm text-white/88">{asset.symbol}</p>
                  <p className="text-[11px] text-white/44">{asset.name}</p>
                </div>
                {asset.symbol === 'KES' && <MpesaIcon size={14} className="ml-auto opacity-60" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwapPanel({
  label,
  asset,
  amount,
  placeholder,
  onSelect,
  exclude,
  editable = false,
  onAmountChange,
}: {
  label: string;
  asset: Asset;
  amount: string;
  placeholder: string;
  onSelect: (symbol: string) => void;
  exclude?: string;
  editable?: boolean;
  onAmountChange?: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#111111] p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>

        {asset.symbol === 'KES' && (
          <div className="flex items-center gap-1.5 rounded-md border border-white/12 bg-[#0f0f0f] px-2 py-1">
            <MpesaIcon size={11} />
            <span className="text-[10px] text-white/48">M-Pesa rail</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <AssetSelector selected={asset} onSelect={onSelect} exclude={exclude} />

        {editable ? (
          <input
            type="text"
            inputMode="decimal"
            placeholder={placeholder}
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.,]/g, '');
              onAmountChange?.(v);
            }}
            className="w-full min-w-0 bg-transparent text-right font-mono text-2xl font-semibold tracking-tight text-white outline-none placeholder:text-white/22"
          />
        ) : (
          <div className="w-full min-w-0 text-right font-mono text-2xl font-semibold tracking-tight text-white">
            {amount || <span className="text-white/22">{placeholder}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function GuestSwapWidget() {
  const {
    source,
    dest,
    sourceAmount,
    numericSourceAmount,
    destAmount,
    rateDisplay,
    setSourceAmount,
    swapDirection,
    updateSource,
    updateDest,
  } = useSwapState();

  const [rotations, setRotations] = useState(0);
  const hasAmount = numericSourceAmount > 0;

  return (
    <div className="mx-auto w-full max-w-[450px]">
      <div className="rounded-xl border border-white/12 bg-[#141414] p-4 shadow-[0_26px_70px_rgba(0,0,0,0.5)] sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-white/12 bg-[#0f0f0f] px-2.5 py-1">
              <Dot className="h-4 w-4 text-emerald" />
              <span className="text-[10px] uppercase tracking-[0.16em] text-white/48">Indicative live quote</span>
            </div>
            <h3 className="mt-2 font-display text-xl tracking-tight text-white-95">Preview a conversion</h3>
          </div>
          <span className="rounded-md border border-gold/25 bg-gold/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-gold">
            Guest flow
          </span>
        </div>

        <div className="space-y-2">
          <SwapPanel
            label="You pay"
            asset={source}
            amount={sourceAmount}
            placeholder="0.00"
            editable
            onSelect={updateSource}
            exclude={dest.symbol}
            onAmountChange={setSourceAmount}
          />

          <div className="flex justify-center py-0.5">
            <motion.button
              type="button"
              onClick={() => {
                swapDirection();
                setRotations((r) => r + 1);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-[#0f0f0f] hover:border-gold/40"
              animate={{ rotate: rotations * 180 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <ArrowUpDown size={14} className="text-gold" />
            </motion.button>
          </div>

          <SwapPanel
            label="You receive"
            asset={dest}
            amount={destAmount}
            placeholder="0.00"
            onSelect={updateDest}
            exclude={source.symbol}
          />
        </div>

        <div className="mt-3 rounded-md border border-white/10 bg-[#101010] px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Quote</p>
              {rateDisplay ? (
                <p className="mt-1 font-mono text-xs text-white/70">{rateDisplay}</p>
              ) : (
                <p className="mt-1 text-xs text-white/42">Connecting to live rates...</p>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-white/42">
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                Instant
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </span>
            </div>
          </div>
        </div>

        <Button size="lg" className="mt-3 h-10 w-full text-sm" asChild>
          <Link
            href={
              hasAmount
                ? `/convert?amount=${encodeURIComponent(sourceAmount)}&from=${source.symbol}&to=${dest.symbol}`
                : `/convert?from=${source.symbol}&to=${dest.symbol}`
            }
          >
            {hasAmount ? 'Continue with this quote' : 'Start conversion'}
          </Link>
        </Button>

        <p className="mt-2 text-center text-[10px] leading-4 text-white/34">
          Guest conversion up to KES 100,000/day. No account required.
        </p>
      </div>
    </div>
  );
}
