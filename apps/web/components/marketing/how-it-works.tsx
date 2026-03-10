'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  CreditCard,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { SectionShell } from '@/components/marketing/section-shell';
import {
  MpesaIcon,
  BtcIcon,
  UsdcIcon,
  UsdtIcon,
  KesIcon,
  UsdIcon,
} from '@/components/marketing/asset-icons';
import { cn } from '@/lib/utils';
import type { ComponentType } from 'react';

/* ─── Premium ease curve ─────────────────────────────────────────── */

const ease = [0.32, 0.72, 0, 1] as const;

/* ─── Step data ──────────────────────────────────────────────────── */

type CurrencyBadge = {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
};

type Step = {
  id: string;
  title: string;
  headline: string;
  description: string;
  icon: ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  color: string;
  colorBg: string;
  colorBorder: string;
  colorGlow: string;
  stat: string;
  statLabel: string;
  detailLabel: string;
  detailValue: string;
  bullets: string[];
  badges?: CurrencyBadge[];
};

const steps: Step[] = [
  {
    id: '01',
    title: 'Fund',
    headline: 'Deposit in seconds, not days',
    description:
      'Send KES via M-Pesa, wire USD from your bank, or deposit BTC, USDC, or USDT from any wallet. Funds land in the right currency wallet instantly.',
    icon: Wallet,
    color: 'text-emerald-400',
    colorBg: 'bg-emerald-400/10',
    colorBorder: 'border-emerald-400/20',
    colorGlow: 'rgba(16,185,129,0.12)',
    stat: '< 3 min',
    statLabel: 'Avg. deposit time',
    detailLabel: 'Supported rails',
    detailValue: 'M-Pesa \u00b7 Bank transfer \u00b7 Crypto deposit',
    bullets: [
      'M-Pesa STK push for instant KES deposits \u2014 tap, confirm PIN, done.',
      'Crypto deposits auto-detect the asset and credit the matching wallet.',
      'Guided KYC tiers unlock higher limits as you grow with the platform.',
    ],
    badges: [
      { icon: MpesaIcon, label: 'M-Pesa' },
      { icon: KesIcon, label: 'KES' },
      { icon: BtcIcon, label: 'BTC' },
    ],
  },
  {
    id: '02',
    title: 'Convert',
    headline: 'Any asset to any asset. Transparent rates.',
    description:
      'Convert between KES, USD, BTC, USDC, and USDT with a locked quote you can review before confirming. Every rate, fee, and output amount is visible upfront.',
    icon: ArrowLeftRight,
    color: 'text-gold',
    colorBg: 'bg-gold/10',
    colorBorder: 'border-gold/20',
    colorGlow: 'rgba(212,175,55,0.12)',
    stat: '30 sec',
    statLabel: 'Quote lock window',
    detailLabel: 'Available pairs',
    detailValue: 'KES \u2194 USD \u2194 BTC \u2194 USDC \u2194 USDT',
    bullets: [
      'Real-time quotes with a 30-second lock so the rate you see is the rate you get.',
      'Full conversion path shown: source amount \u2192 rate \u2192 fees \u2192 destination amount.',
      'All 20 asset pairs supported \u2014 fiat to crypto, crypto to stablecoin, and back.',
    ],
    badges: [
      { icon: KesIcon, label: 'KES' },
      { icon: UsdIcon, label: 'USD' },
      { icon: BtcIcon, label: 'BTC' },
      { icon: UsdcIcon, label: 'USDC' },
      { icon: UsdtIcon, label: 'USDT' },
    ],
  },
  {
    id: '03',
    title: 'Hold',
    headline: 'Five wallets. One unified vault.',
    description:
      'Your KES, USD, BTC, USDC, and USDT each live in a dedicated wallet with independent balances. See your total portfolio value denominated in any currency you choose.',
    icon: ShieldCheck,
    color: 'text-cyan',
    colorBg: 'bg-cyan/10',
    colorBorder: 'border-cyan/20',
    colorGlow: 'rgba(0,229,255,0.10)',
    stat: '5',
    statLabel: 'Synced wallets',
    detailLabel: 'Security',
    detailValue: 'Segregated custody \u00b7 Encrypted at rest',
    bullets: [
      'Each currency has its own wallet \u2014 no commingling of fiat and crypto balances.',
      'Portfolio dashboard shows combined value across all wallets in real time.',
      'Institutional-grade custody with per-asset isolation and audit trails.',
    ],
    badges: [
      { icon: KesIcon, label: 'KES' },
      { icon: UsdIcon, label: 'USD' },
      { icon: BtcIcon, label: 'BTC' },
      { icon: UsdcIcon, label: 'USDC' },
      { icon: UsdtIcon, label: 'USDT' },
    ],
  },
  {
    id: '04',
    title: 'Spend',
    headline: 'Turn any balance into real-world action',
    description:
      'Pay with virtual or physical Koya cards, send money across borders, or invest in global stock markets \u2014 all from the same platform, any currency.',
    icon: CreditCard,
    color: 'text-gold',
    colorBg: 'bg-gold/10',
    colorBorder: 'border-gold/20',
    colorGlow: 'rgba(212,175,55,0.12)',
    stat: '180+',
    statLabel: 'Countries reached',
    detailLabel: 'Channels',
    detailValue: 'Cards \u00b7 Global transfers \u00b7 Stock markets',
    bullets: [
      'Virtual cards issued instantly \u2014 spend BTC or USDC at any Visa merchant worldwide.',
      'Send USD or KES to bank accounts and mobile wallets across Africa and beyond.',
      'Access fractional US stocks through integrated brokerage \u2014 buy $10 of AAPL with KES.',
    ],
  },
];

const AUTO_ADVANCE_MS = 5000;
const PAUSE_DURATION_MS = 10000;

/* ─── Component ──────────────────────────────────────────────────── */

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = steps[active] as Step;
  const CurrentIcon = current.icon;
  const nextStep = steps[(active + 1) % steps.length] as Step;

  const clearPause = useCallback(() => {
    if (pauseRef.current) {
      clearTimeout(pauseRef.current);
      pauseRef.current = null;
    }
  }, []);

  const selectStep = useCallback(
    (index: number) => {
      setActive(index);
      setPaused(true);
      clearPause();
      pauseRef.current = setTimeout(() => setPaused(false), PAUSE_DURATION_MS);
    },
    [clearPause],
  );

  const advance = useCallback(() => {
    setActive((prev) => (prev + 1) % steps.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(advance, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [advance, paused]);

  useEffect(() => () => clearPause(), [clearPause]);

  /* Keyboard navigation */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        selectStep((active + 1) % steps.length);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        selectStep((active - 1 + steps.length) % steps.length);
      }
    },
    [active, selectStep],
  );

  /* Dot color helper */
  const dotColor =
    current.color === 'text-emerald-400'
      ? 'bg-emerald-400'
      : current.color === 'text-cyan'
        ? 'bg-cyan'
        : 'bg-gold';

  return (
    <SectionShell id="how-it-works" bg="surface">
      <div className="mx-auto max-w-6xl">
        {/* ── Section header ─────────────────────────────────────── */}
        <div className="mb-12 md:mb-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold/80">
              How It Works
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-white-95 sm:text-4xl lg:text-5xl">
              Four steps from any currency
              <br className="hidden sm:block" />
              to any destination
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white-50 sm:text-base">
              Koya connects M-Pesa, bank accounts, crypto wallets, and global
              markets into one flow. Fund, convert, hold, and spend &mdash;
              across five currencies, in seconds.
            </p>
          </div>
        </div>

        {/* ── Desktop timeline ───────────────────────────────────── */}
        <div className="mb-10 hidden lg:block">
          <div className="relative mx-auto max-w-2xl">
            {/* Track line — pinned to circle center (h-12 = 48px → center at 24px) */}
            <div className="absolute left-0 right-0 top-[24px] h-[2px] bg-white/8" />
            {/* Active fill */}
            <motion.div
              className="absolute left-0 top-[24px] h-[2px] bg-[linear-gradient(90deg,#A88520,#D4AF37,#F0D060)]"
              animate={{ width: `${(active / (steps.length - 1)) * 100}%` }}
              transition={{ duration: 0.5, ease }}
            />

            {/* Step nodes + connector arrows */}
            <div
              className="relative flex justify-between"
              role="tablist"
              aria-label="How it works steps"
              onKeyDown={handleKeyDown}
            >
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === active;
                const isPast = index < active;
                const isLast = index === steps.length - 1;
                const isNextPast = index < active - 1;

                return (
                  <div key={step.id} className="relative flex flex-1 items-start">
                    {/* Node button */}
                    <button
                      role="tab"
                      type="button"
                      aria-selected={isActive}
                      aria-controls={`step-panel-${step.id}`}
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => selectStep(index)}
                      className="group relative z-10 flex flex-col items-center gap-2.5"
                      style={{ width: 48 }}
                    >
                      {/* Circle node with icon */}
                      <div className="relative">
                        {/* Glow ring on active */}
                        {isActive && (
                          <motion.div
                            className="absolute -inset-2.5 rounded-full"
                            style={{
                              background: `radial-gradient(circle, ${step.colorGlow}, transparent 70%)`,
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0.4, 0.8, 0.4] }}
                            transition={{
                              duration: 2.5,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          />
                        )}
                        <div
                          className={cn(
                            'relative flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-[0_0_0_6px_#0A0A0A] transition-all duration-300',
                            isActive
                              ? cn(step.colorBorder, 'bg-surface', step.color)
                              : isPast
                                ? 'border-emerald-400/30 bg-surface text-emerald-400'
                                : 'border-white/10 bg-surface-raised text-white-40 group-hover:border-white/20 group-hover:bg-white/[0.06]',
                          )}
                        >
                          {isPast && !isActive ? (
                            <Check size={16} strokeWidth={2.5} />
                          ) : (
                            <StepIcon size={18} strokeWidth={1.8} />
                          )}
                        </div>
                      </div>

                      {/* Label */}
                      <div className="text-center">
                        <p
                          className={cn(
                            'font-mono text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors',
                            isActive
                              ? step.color
                              : isPast
                                ? 'text-white-50'
                                : 'text-white-30',
                          )}
                        >
                          {step.id}
                        </p>
                        <p
                          className={cn(
                            'mt-0.5 text-sm font-semibold transition-colors',
                            isActive ? 'text-white-95' : 'text-white-60',
                          )}
                        >
                          {step.title}
                        </p>
                      </div>
                    </button>

                    {/* Connector arrow between nodes */}
                    {!isLast && (
                      <div className="absolute left-[48px] right-0 top-[24px] flex -translate-y-1/2 items-center justify-center">
                        <motion.div
                          animate={{
                            opacity: isPast || isActive ? 0.8 : 0.25,
                          }}
                          transition={{ duration: 0.4 }}
                        >
                          <svg
                            width="12"
                            height="10"
                            viewBox="0 0 12 10"
                            fill="none"
                            className={cn(
                              'transition-colors duration-300',
                              isNextPast || isPast
                                ? 'text-gold'
                                : 'text-white/20',
                            )}
                          >
                            <path
                              d="M7 1L11 5L7 9"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M0 5H10"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </motion.div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Mobile step selector ───────────────────────────────── */}
        <div
          className="mb-6 flex gap-2 overflow-x-auto lg:hidden"
          role="tablist"
          aria-label="How it works steps"
        >
          {steps.map((step, index) => {
            const isActive = index === active;
            const MobileIcon = step.icon;
            return (
              <button
                key={step.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`step-panel-${step.id}`}
                onClick={() => selectStep(index)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300',
                  isActive
                    ? cn(step.colorBorder, step.colorBg, step.color)
                    : 'border-white/8 bg-white/[0.03] text-white-50 hover:border-white/15',
                )}
              >
                <MobileIcon size={14} strokeWidth={1.8} />
                {step.title}
              </button>
            );
          })}
        </div>

        {/* ── Mobile progress bar ────────────────────────────────── */}
        <div className="mb-6 h-[2px] overflow-hidden rounded-full bg-white/6 lg:hidden">
          <motion.div
            className="h-full rounded-full bg-[linear-gradient(90deg,#A88520,#D4AF37,#F0D060)]"
            animate={{
              width: `${((active + 1) / steps.length) * 100}%`,
            }}
            transition={{ duration: 0.5, ease }}
          />
        </div>

        {/* ── Detail panel ───────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            id={`step-panel-${current.id}`}
            role="tabpanel"
            aria-labelledby={`step-tab-${current.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease }}
            className="relative overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] shadow-[0_24px_80px_rgba(0,0,0,0.3)]"
          >
            {/* Ambient glow keyed to step color */}
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full blur-3xl"
              style={{ background: current.colorGlow }}
            />

            <div className="relative z-10 grid gap-0 lg:grid-cols-[1fr_300px]">
              {/* ── Main content ──────────────────────────────────── */}
              <div className="p-6 sm:p-8 lg:p-10">
                {/* Icon + headline */}
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border',
                      current.colorBorder,
                      current.colorBg,
                      current.color,
                    )}
                  >
                    <CurrentIcon size={24} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p
                      className={cn(
                        'text-[11px] font-semibold uppercase tracking-[0.22em]',
                        current.color,
                      )}
                    >
                      Step {current.id} &mdash; {current.title}
                    </p>
                    <h3 className="mt-2 font-display text-2xl font-bold leading-tight text-white-95 sm:text-3xl">
                      {current.headline}
                    </h3>
                  </div>
                </div>

                <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white-55">
                  {current.description}
                </p>

                {/* Bullet features */}
                <div className="mt-8 space-y-3">
                  {current.bullets.map((bullet, i) => (
                    <motion.div
                      key={bullet}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: 0.1 + i * 0.08,
                        ease,
                      }}
                      className="flex items-start gap-3"
                    >
                      <div
                        className={cn(
                          'mt-2 h-1.5 w-1.5 shrink-0 rounded-full',
                          dotColor,
                        )}
                      />
                      <p className="text-sm leading-7 text-white-60">
                        {bullet}
                      </p>
                    </motion.div>
                  ))}
                </div>

                {/* Currency badges */}
                {current.badges && (
                  <div className="mt-8 flex flex-wrap items-center gap-2">
                    {current.badges.map((badge, i) => (
                      <motion.div
                        key={badge.label}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.3,
                          delay: 0.25 + i * 0.06,
                          ease,
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white-70"
                      >
                        <badge.icon size={14} />
                        {badge.label}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Sidebar metrics ──────────────────────────────── */}
              <div className="border-t border-white/6 p-6 sm:p-8 lg:border-l lg:border-t-0">
                <div className="space-y-4">
                  {/* Primary stat */}
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white-30">
                      {current.statLabel}
                    </p>
                    <p className="mt-2 font-mono text-3xl font-semibold text-white-95">
                      {current.stat}
                    </p>
                  </div>

                  {/* Detail card */}
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white-30">
                      {current.detailLabel}
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-white-75">
                      {current.detailValue}
                    </p>
                  </div>

                  {/* Next step preview */}
                  <button
                    type="button"
                    onClick={() =>
                      selectStep((active + 1) % steps.length)
                    }
                    className="group flex w-full items-center justify-between rounded-xl border border-white/6 bg-white/[0.02] p-4 text-left transition hover:border-white/12 hover:bg-white/[0.04]"
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white-30">
                        Next
                      </p>
                      <p className="mt-1 text-sm font-medium text-white-70">
                        {nextStep.title}
                      </p>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-gold/60 transition-transform group-hover:translate-x-1"
                    />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </SectionShell>
  );
}