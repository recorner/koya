'use client';

import type { ComponentType } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  CreditCard,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Wallet,
} from 'lucide-react';
import {
  BtcIcon,
  KesIcon,
  MpesaIcon,
  UsdcIcon,
  UsdtIcon,
  UsdIcon,
} from '@/components/marketing/asset-icons';
import { SectionShell } from '@/components/marketing/section-shell';
import { cn } from '@/lib/utils';

const ease = [0.32, 0.72, 0, 1] as const;

type CurrencyBadge = {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
};

type Step = {
  id: string;
  title: string;
  eyebrow: string;
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
    eyebrow: 'Entry rails',
    headline: 'Bring value into Koya without breaking momentum.',
    description:
      'Start from the rail users already trust: M-Pesa, bank transfer, or crypto deposit. Funding lands into the right wallet context from the beginning, so the rest of the journey stays legible.',
    icon: Wallet,
    color: 'text-emerald-400',
    colorBg: 'bg-emerald-400/10',
    colorBorder: 'border-emerald-400/20',
    colorGlow: 'rgba(16,185,129,0.12)',
    stat: '< 3 min',
    statLabel: 'Typical local funding speed',
    detailLabel: 'Funding rails',
    detailValue: 'M-Pesa, bank transfer, and crypto deposit flow into mapped wallet layers.',
    bullets: [
      'KES funding starts with a local-first rail instead of forcing users into a foreign onboarding pattern.',
      'Incoming assets are reconciled into the correct wallet so balances stay explainable.',
      'Verification expands progressively as account usage and limits increase.',
    ],
    badges: [
      { icon: MpesaIcon, label: 'M-Pesa' },
      { icon: KesIcon, label: 'KES wallet' },
      { icon: BtcIcon, label: 'BTC deposit' },
    ],
  },
  {
    id: '02',
    title: 'Convert',
    eyebrow: 'Pricing clarity',
    headline: 'See the path, the output, and the timing before you commit.',
    description:
      'Koya presents conversion as one controlled move between wallets, not a black-box trade ticket. The quote, destination asset, and lock window remain visible through the entire step.',
    icon: ArrowLeftRight,
    color: 'text-gold',
    colorBg: 'bg-gold/10',
    colorBorder: 'border-gold/20',
    colorGlow: 'rgba(212,175,55,0.12)',
    stat: '30 sec',
    statLabel: 'Quote protection window',
    detailLabel: 'Supported paths',
    detailValue: 'KES, USD, BTC, USDC, and USDT operate as one connected asset graph.',
    bullets: [
      'Users see the source amount, output amount, and quote state before execution.',
      'Pricing language stays tied to wallets and balances instead of trader-only terminology.',
      'Movement across assets is designed to feel like portfolio reallocation, not a separate product.',
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
    eyebrow: 'Wallet system',
    headline: 'Keep multiple balances distinct while the portfolio still reads as one system.',
    description:
      'Each asset retains its own wallet context, but Koya still gives the user a coherent portfolio view. That separation is what makes the interface feel safe rather than improvised.',
    icon: ShieldCheck,
    color: 'text-cyan',
    colorBg: 'bg-cyan/10',
    colorBorder: 'border-cyan/20',
    colorGlow: 'rgba(0,229,255,0.10)',
    stat: '5',
    statLabel: 'Wallet layers in one portfolio',
    detailLabel: 'Balance logic',
    detailValue: 'Asset-specific wallets with one portfolio view and one operational history.',
    bullets: [
      'Users can understand where value sits without mixing every balance into one ambiguous number.',
      'Portfolio visibility remains unified even though each asset keeps its own context.',
      'Clear wallet separation improves confidence before a conversion, withdrawal, or spend action.',
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
    title: 'Deploy',
    eyebrow: 'Outward utility',
    headline: 'Turn stored value into spending, transfers, and market access.',
    description:
      'Once funds are inside the system, Koya lets users push value outward through cards, transfers, and investing flows without losing continuity or moving into separate interfaces.',
    icon: CreditCard,
    color: 'text-gold',
    colorBg: 'bg-gold/10',
    colorBorder: 'border-gold/20',
    colorGlow: 'rgba(212,175,55,0.12)',
    stat: '180+',
    statLabel: 'Global destinations supported',
    detailLabel: 'Output channels',
    detailValue: 'Cards, transfers, and market access sit on the same wallet foundation.',
    bullets: [
      'Physical and virtual card spending can route directly from the underlying wallet system.',
      'Transfers keep outward movement attached to the same operating history and controls.',
      'Investment access extends the wallet model instead of introducing a disconnected brokerage shell.',
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
          <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgba(212,175,55,0.9)]">
              How Koya works
            </p>

            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              One operating model from
              <span className="block bg-[linear-gradient(180deg,#F0D060_0%,#D4AF37_48%,#A88520_100%)] bg-clip-text text-transparent">
                local funding to global deployment
              </span>
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/56 sm:text-base">
              Koya is designed as a connected money system. Value comes in through familiar rails, moves between wallets with visible pricing, and leaves through cards, transfers, or market access without losing continuity.
            </p>
          </div>

          <div
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            role="tablist"
            aria-label="How Koya works steps"
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
                  className={cn(
                    'group relative overflow-hidden rounded-[26px] border p-5 text-left transition-[transform,border-color,background-color,box-shadow] duration-300',
                    isActive
                      ? cn(
                          step.colorBorder,
                          'bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] shadow-[0_18px_48px_rgba(0,0,0,0.28)]'
                        )
                      : isPast
                        ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]'
                        : 'border-white/8 bg-white/[0.025] hover:-translate-y-px hover:border-white/14 hover:bg-white/[0.04]'
                  )}
                >
                  {isActive ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-px"
                      style={{ background: `linear-gradient(90deg, transparent, ${current.colorGlow}, transparent)` }}
                    />
                  ) : null}

                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-2xl border',
                        isActive
                          ? cn(step.colorBorder, step.colorBg, step.color)
                          : isPast
                            ? 'border-white/10 bg-white/[0.04] text-white/70'
                            : 'border-white/10 bg-white/[0.03] text-white/44'
                      )}
                    >
                      {isPast && !isActive ? <Check size={18} strokeWidth={2.4} /> : <StepIcon size={18} strokeWidth={1.9} />}
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
                        Step {step.id}
                      </p>
                      <p className={cn('mt-1 text-sm font-semibold', isActive ? 'text-white' : 'text-white/66')}>
                        {step.title}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className={cn('text-[10px] font-semibold uppercase tracking-[0.2em]', isActive ? step.color : 'text-white/34')}>
                      {step.eyebrow}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/62">{step.detailValue}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              id={`step-panel-${current.id}`}
              role="tabpanel"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.42, ease }}
              className="relative mt-8 overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur-md"
            >
              <div
                className="pointer-events-none absolute -right-16 -top-12 h-64 w-64 rounded-full blur-3xl"
                style={{ background: current.colorGlow }}
              />

              <div className="relative z-10 grid gap-0 lg:grid-cols-[minmax(0,1.14fr)_340px]">
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
                      <p className={cn('text-[11px] font-semibold uppercase tracking-[0.22em]', current.color)}>
                        Step {current.id} · {current.title}
                      </p>

                      <h3 className="mt-2 max-w-2xl font-display text-2xl font-bold leading-tight text-white sm:text-3xl">
                        {current.headline}
                      </h3>
                    </div>
                  </div>

                  <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/58">{current.description}</p>

                  <div className="mt-8 grid gap-3">
                    {current.bullets.map((bullet, index) => (
                      <motion.div
                        key={bullet}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: 0.08 + index * 0.07, ease }}
                        className="rounded-[22px] border border-white/6 bg-white/[0.03] px-4 py-3.5"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', dotColor)} />
                          <p className="text-sm leading-7 text-white/68">{bullet}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {current.badges ? (
                    <div className="mt-8 flex flex-wrap gap-2">
                      {current.badges.map((badge, index) => (
                        <motion.div
                          key={badge.label}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.28, delay: 0.18 + index * 0.05, ease }}
                          className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/72"
                        >
                          <badge.icon size={14} />
                          {badge.label}
                        </motion.div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 border-t border-white/6 p-6 sm:grid-cols-2 sm:p-8 lg:border-l lg:border-t-0 lg:grid-cols-1">
                  <div className="rounded-[24px] border border-white/8 bg-black/20 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[rgba(212,175,55,0.85)]" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">
                        Key signal
                      </p>
                    </div>
                    <p className="font-mono text-3xl font-semibold text-white">{current.stat}</p>
                    <p className="mt-2 text-sm text-white/56">{current.statLabel}</p>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">
                      {current.detailLabel}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-white/72">{current.detailValue}</p>
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
                        ? 'Auto-advance pauses while the user inspects a step.'
                        : 'The preview rotates through the full operating model automatically.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => selectStep((active + 1) % steps.length)}
                    className="group rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4 text-left transition-[transform,border-color,background-color] duration-200 hover:-translate-y-px hover:border-[rgba(212,175,55,0.16)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))] sm:col-span-2 lg:col-span-1"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">
                          Next step
                        </p>
                        <p className="mt-1 text-sm font-medium text-white/76">{nextStep.title}</p>
                      </div>

                      <ArrowRight
                        size={16}
                        className="text-[rgba(212,175,55,0.72)] transition-transform duration-200 group-hover:translate-x-1"
                      />
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </SectionShell>
    </div>
  );
}