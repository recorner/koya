'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpDown,
  ChevronDown,
  Dot,
  ShieldCheck,
  TimerReset,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AssetIcon, MpesaIcon } from '@/components/marketing/asset-icons';
import {
  ASSETS,
  ASSET_LIST,
  MOCK_RATES,
  type Asset,
} from '@/components/marketing/asset-metadata';

/* ─── Swap state hook ──────────────────────────────────────────── */

function useSwapState() {
  const [sourceSymbol, setSourceSymbol] = useState('KES');
  const [destSymbol, setDestSymbol] = useState('BTC');
  const [sourceAmount, setSourceAmount] = useState('');

  const source = ASSETS[sourceSymbol]!;
  const dest = ASSETS[destSymbol]!;
  const rate = MOCK_RATES[sourceSymbol]?.[destSymbol] ?? 0;

  const numericSourceAmount = useMemo(() => {
    const val = parseFloat(sourceAmount.replace(/,/g, ''));
    return !val || val <= 0 ? 0 : val;
  }, [sourceAmount]);

  const destAmount = useMemo(() => {
    if (!numericSourceAmount || !rate) return '';
    const result = numericSourceAmount * rate;

    if (dest.type === 'crypto') return result.toFixed(8);
    if (dest.type === 'stablecoin') return result.toFixed(2);

    return result.toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });
  }, [numericSourceAmount, rate, dest.type]);

  const rateDisplay = useMemo(() => {
    if (!rate) return '';
    const formatted =
      rate < 0.001
        ? rate.toFixed(8)
        : rate.toLocaleString('en-US', { maximumFractionDigits: 2 });

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
    [destSymbol, sourceSymbol]
  );

  const updateDest = useCallback(
    (symbol: string) => {
      if (symbol === sourceSymbol) setSourceSymbol(destSymbol);
      setDestSymbol(symbol);
    },
    [sourceSymbol, destSymbol]
  );

  return {
    source,
    dest,
    sourceAmount,
    numericSourceAmount,
    destAmount,
    rate,
    rateDisplay,
    setSourceAmount,
    swapDirection,
    updateSource,
    updateDest,
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
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition-all duration-200 hover:bg-white/[0.07]"
      >
        <AssetIcon symbol={selected.symbol} size={20} />
        <span className="font-mono text-sm font-semibold text-white">
          {selected.symbol}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            'text-white/40 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 z-50 mt-2 min-w-[190px] overflow-hidden rounded-2xl border border-white/10 bg-[#0E0E0E]/95 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-md"
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
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-white/[0.05]',
                  asset.symbol === selected.symbol && 'bg-white/[0.06]'
                )}
              >
                <AssetIcon symbol={asset.symbol} size={18} />

                <div>
                  <p className="font-mono text-sm font-medium text-white">
                    {asset.symbol}
                  </p>
                  <p className="text-[11px] text-white/42">{asset.name}</p>
                </div>

                {asset.symbol === 'KES' && (
                  <MpesaIcon size={14} className="ml-auto opacity-60" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Panel row ────────────────────────────────────────────────── */

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
    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
          {label}
        </p>

        {asset.symbol === 'KES' ? (
          <div className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-2 py-1">
            <MpesaIcon size={12} />
            <span className="text-[10px] text-white/45">M-Pesa rail</span>
          </div>
        ) : null}
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
            className="w-full min-w-0 bg-transparent text-right font-mono text-2xl font-semibold tracking-tight text-white outline-none placeholder:text-white/20"
          />
        ) : (
          <div className="w-full min-w-0 text-right font-mono text-2xl font-semibold tracking-tight text-white">
            {amount || <span className="text-white/20">{placeholder}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main swap widget ─────────────────────────────────────────── */

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
    <div className="mx-auto w-full max-w-[460px]">
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-6">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[rgba(212,175,55,0.10)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-28 rounded-full bg-[rgba(0,229,255,0.06)] blur-2xl" />

        {/* Header */}
        <div className="relative mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1">
              <Dot className="h-4 w-4 text-emerald-300" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                Indicative live quote
              </span>
            </div>

            <h3 className="font-display text-xl font-bold tracking-tight text-white">
              Convert between wallets
            </h3>

            <p className="mt-1 text-sm leading-6 text-white/52">
              Preview cross-asset conversion across fiat, crypto, and stablecoins.
            </p>
          </div>

          <div className="rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.08)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(212,175,55,0.95)]">
            Guest mode
          </div>
        </div>

        {/* Panels */}
        <div className="relative space-y-3">
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

          {/* Swap button */}
          <div className="relative z-10 flex justify-center py-1">
            <motion.button
              type="button"
              onClick={() => {
                swapDirection();
                setRotations((r) => r + 1);
              }}
              className="group flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-[rgba(212,175,55,0.22)] hover:bg-[#151515]"
              animate={{ rotate: rotations * 180 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            >
              <ArrowUpDown
                size={16}
                className="text-[rgba(212,175,55,0.95)] transition-transform duration-200 group-hover:scale-110"
              />
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

        {/* Quote meta */}
        <div className="mt-4 rounded-[24px] border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">
                Quote summary
              </p>
              <p className="mt-2 font-mono text-xs text-white/62">
                {rateDisplay || 'Enter an amount to preview conversion'}
              </p>
            </div>

            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1.5 sm:flex">
              <TimerReset className="h-3.5 w-3.5 text-white/42" />
              <span className="text-[10px] text-white/45">Refreshes live</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3">
              <div className="mb-1 flex items-center gap-2 text-white/40">
                <Zap className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-[0.14em]">
                  Execution
                </span>
              </div>
              <div className="text-sm font-medium text-white/80">
                Instant on sign up
              </div>
            </div>

            <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3">
              <div className="mb-1 flex items-center gap-2 text-white/40">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-[0.14em]">
                  Quote quality
                </span>
              </div>
              <div className="text-sm font-medium text-white/80">
                Indicative market rate
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Button
          size="lg"
          className="mt-5 h-12 w-full text-base font-medium"
          disabled={!hasAmount}
        >
          {hasAmount ? 'Unlock live conversion' : 'Enter amount to continue'}
        </Button>

        {/* Disclaimer */}
        <p className="mt-3 text-center text-[10px] leading-5 text-white/28">
          Preview rates are indicative and may move with market conditions. Create
          an account for live quotes, execution, and wallet settlement.
        </p>
      </div>
    </div>
  );
}