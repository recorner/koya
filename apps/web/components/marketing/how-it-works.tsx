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
  Sparkles,
  TimerReset,
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

const ease = [0.32, 0.72, 0, 1] as const;

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
    headline: 'Deposit in seconds, not in banking geologic time.',
    description:
      'Move money into Koya through M-Pesa, bank transfer, or crypto deposit. Funds land in the matching wallet layer so you can act immediately instead of waiting around like it’s 2009.',
    icon: Wallet,
    color: 'text-emerald-400',
    colorBg: 'bg-emerald-400/10',
    colorBorder: 'border-emerald-400/20',
    colorGlow: 'rgba(16,185,129,0.12)',
    stat: '< 3 min',
    statLabel: 'Typical deposit speed',
    detailLabel: 'Funding rails',
    detailValue: 'M-Pesa · Bank transfer · Crypto deposit',
    bullets: [
      'KES funding can begin with an M-Pesa flow built for fast local entry.',
      'Crypto deposits are matched to the right asset wallet after detection.',
      'Verification tiers help expand limits as account usage grows.',
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
    headline: 'Move from any supported asset to the next one cleanly.',
    description:
      'Switch between KES, USD, BTC, USDC, and USDT with visible quote logic, clear output expectations, and fewer ugly surprises hiding behind the button.',
    icon: ArrowLeftRight,
    color: 'text-gold',
    colorBg: 'bg-gold/10',
    colorBorder: 'border-gold/20',
    colorGlow: 'rgba(212,175,55,0.12)',
    stat: '30 sec',
    statLabel: 'Quote lock window',
    detailLabel: 'Supported pathing',
    detailValue: 'KES ↔ USD ↔ BTC ↔ USDC ↔ USDT',
    bullets: [
      'Quotes are presented before execution so the conversion path stays legible.',
      'Source amount, output amount, and pricing logic are surfaced upfront.',
      'Cross-asset movement is designed to feel like one connected money graph.',
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
    headline: 'Multiple wallets, one financial command surface.',
    description:
      'Each supported asset lives in a dedicated wallet context, while Koya still lets the user understand the full portfolio as one coherent system.',
    icon: ShieldCheck,
    color: 'text-cyan',
    colorBg: 'bg-cyan/10',
    colorBorder: 'border-cyan/20',
    colorGlow: 'rgba(0,229,255,0.10)',
    stat: '5',
    statLabel: 'Wallet layers',
    detailLabel: 'Portfolio logic',
    detailValue: 'Segregated balances · Unified portfolio view',
    bullets: [
      'Wallets remain asset-specific instead of mushing everything into one soup.',
      'Combined portfolio visibility helps users see total value across holdings.',
      'Operational clarity improves when balances and asset contexts stay distinct.',
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
    headline: 'Turn stored value into spending, transfers, and market access.',
    description:
      'Once value is inside the system, users can push it outward through cards, transfers, and investing flows without jumping into disconnected products.',
    icon: CreditCard,
    color: 'text-gold',
    colorBg: 'bg-gold/10',
    colorBorder: 'border-gold/20',
    colorGlow: 'rgba(212,175,55,0.12)',
    stat: '180+',
    statLabel: 'Destination reach',
    detailLabel: 'Output channels',
    detailValue: 'Cards · Transfers · Investing access',
    bullets: [
      'Virtual and physical card rails can sit on top of the same wallet stack.',
      'Transfers can extend value outward without forcing users into separate tools.',
      'Investment access turns stored capital into deployable global exposure.',
    ],
  },
];

const AUTO_ADVANCE_MS = 7500;
const PAUSE_DURATION_MS = 10000;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const pauseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

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
    [clearPause]
  );

  const advance = useCallback(() => {
    setActive((prev) => (prev + 1) % steps.length);
  }, []);

  useEffect(() => {
    if (paused || !visible) return;
    const id = setInterval(advance, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [advance, paused, visible]);

  useEffect(() => {
    return () => clearPause();
  }, [clearPause]);

  // Pause auto-advance when section is off-screen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!!entry?.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    [active, selectStep]
  );

  const dotColor =
    current.color === 'text-emerald-400'
      ? 'bg-emerald-400'
      : current.color === 'text-cyan'
      ? 'bg-cyan'
      : 'bg-gold';

  return (
    <div ref={sectionRef}>
    <SectionShell id="how-it-works" bg="surface">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(212,175,55,0.90)]">
            How Koya works
          </p>

          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            One operating flow from
            <span className="block bg-[linear-gradient(180deg,#F0D060_0%,#D4AF37_48%,#A88520_100%)] bg-clip-text text-transparent">
              funding to deployment
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/56 sm:text-base">
            Koya is designed as a connected money system: bring value in, move it
            across currencies, hold it with clarity, and push it outward through
            spending, transfers, or investing.
          </p>
        </div>

        {/* Desktop rail */}
        <div className="mb-10 hidden lg:block">
          <div className="relative mx-auto max-w-4xl">
            <div className="absolute left-0 right-0 top-[28px] h-[2px] bg-white/8" />

            <motion.div
              className="absolute left-0 top-[28px] h-[2px] bg-[linear-gradient(90deg,#A88520,#D4AF37,#F0D060)]"
              animate={{ width: `${(active / (steps.length - 1)) * 100}%` }}
              transition={{ duration: 0.5, ease }}
            />

            <div
              className="relative grid grid-cols-4 gap-6"
              role="tablist"
              aria-label="How it works steps"
              onKeyDown={handleKeyDown}
            >
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === active;
                const isPast = index < active;

                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`step-panel-${step.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => selectStep(index)}
                    className="group relative flex flex-col items-center text-center"
                  >
                    {isActive && (
                      <motion.div
                        className="absolute left-1/2 top-[28px] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
                        style={{ background: step.colorGlow }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.35, 0.8, 0.35] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}

                    <div
                      className={cn(
                        'relative z-10 flex h-14 w-14 items-center justify-center rounded-full border shadow-[0_0_0_6px_#0A0A0A] transition-all duration-300',
                        isActive
                          ? cn(step.colorBorder, 'bg-[#0D0D0D]', step.color)
                          : isPast
                          ? 'border-emerald-400/25 bg-[#0D0D0D] text-emerald-400'
                          : 'border-white/10 bg-white/[0.03] text-white/42 group-hover:border-white/18 group-hover:bg-white/[0.05]'
                      )}
                    >
                      {isPast && !isActive ? (
                        <Check size={18} strokeWidth={2.4} />
                      ) : (
                        <StepIcon size={20} strokeWidth={1.8} />
                      )}
                    </div>

                    <div className="mt-4">
                      <p
                        className={cn(
                          'font-mono text-[10px] font-semibold uppercase tracking-[0.18em]',
                          isActive
                            ? step.color
                            : isPast
                            ? 'text-white/46'
                            : 'text-white/28'
                        )}
                      >
                        Step {step.id}
                      </p>
                      <p
                        className={cn(
                          'mt-1 text-sm font-semibold transition-colors',
                          isActive ? 'text-white' : 'text-white/64'
                        )}
                      >
                        {step.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile tabs */}
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
                    : 'border-white/8 bg-white/[0.03] text-white/54 hover:border-white/14'
                )}
              >
                <MobileIcon size={14} strokeWidth={1.8} />
                {step.title}
              </button>
            );
          })}
        </div>

        <div className="mb-6 h-[2px] overflow-hidden rounded-full bg-white/6 lg:hidden">
          <motion.div
            className="h-full rounded-full bg-[linear-gradient(90deg,#A88520,#D4AF37,#F0D060)]"
            animate={{ width: `${((active + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.5, ease }}
          />
        </div>

        {/* Main panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            id={`step-panel-${current.id}`}
            role="tabpanel"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.42, ease }}
            className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.03)_100%)] shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur-md"
          >
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl"
              style={{ background: current.colorGlow }}
            />

            <div className="relative z-10 grid gap-0 xl:grid-cols-[1.15fr_380px]">
              {/* Main content */}
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border',
                      current.colorBorder,
                      current.colorBg,
                      current.color
                    )}
                  >
                    <CurrentIcon size={24} strokeWidth={1.8} />
                  </div>

                  <div>
                    <p
                      className={cn(
                        'text-[11px] font-semibold uppercase tracking-[0.22em]',
                        current.color
                      )}
                    >
                      Step {current.id} · {current.title}
                    </p>

                    <h3 className="mt-2 max-w-2xl font-display text-2xl font-bold leading-tight text-white sm:text-3xl">
                      {current.headline}
                    </h3>
                  </div>
                </div>

                <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/58">
                  {current.description}
                </p>

                <div className="mt-8 grid gap-3">
                  {current.bullets.map((bullet, i) => (
                    <motion.div
                      key={bullet}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: 0.08 + i * 0.07,
                        ease,
                      }}
                      className="rounded-[22px] border border-white/6 bg-white/[0.03] px-4 py-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'mt-2 h-1.5 w-1.5 shrink-0 rounded-full',
                            dotColor
                          )}
                        />
                        <p className="text-sm leading-7 text-white/68">{bullet}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {current.badges && (
                  <div className="mt-8 flex flex-wrap gap-2">
                    {current.badges.map((badge, i) => (
                      <motion.div
                        key={badge.label}
                        initial={{ opacity: 0, scale: 0.86 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.28,
                          delay: 0.18 + i * 0.05,
                          ease,
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/72"
                      >
                        <badge.icon size={14} />
                        {badge.label}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="border-t border-white/6 p-6 sm:p-8 xl:border-l xl:border-t-0">
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[rgba(212,175,55,0.85)]" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">
                        Key signal
                      </p>
                    </div>
                    <p className="font-mono text-3xl font-semibold text-white">
                      {current.stat}
                    </p>
                    <p className="mt-2 text-sm text-white/56">{current.statLabel}</p>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">
                      {current.detailLabel}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-white/72">
                      {current.detailValue}
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <TimerReset className="h-4 w-4 text-white/40" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">
                        Flow behavior
                      </p>
                    </div>
                    <p className="text-sm leading-6 text-white/62">
                      {paused
                        ? 'Auto-advance is paused while you inspect this step.'
                        : 'Steps rotate automatically to preview the full operating flow.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => selectStep((active + 1) % steps.length)}
                    className="group flex w-full items-center justify-between rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4 text-left transition-all duration-200 hover:border-[rgba(212,175,55,0.16)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))]"
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">
                        Next step
                      </p>
                      <p className="mt-1 text-sm font-medium text-white/76">
                        {nextStep.title}
                      </p>
                    </div>

                    <ArrowRight
                      size={16}
                      className="text-[rgba(212,175,55,0.72)] transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </SectionShell>
    </div>
  );
}