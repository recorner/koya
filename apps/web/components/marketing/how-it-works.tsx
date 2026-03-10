'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ArrowLeftRight, ShieldCheck, CreditCard } from 'lucide-react';
import { SectionShell } from '@/components/marketing/section-shell';
import { MpesaIcon } from '@/components/marketing/asset-icons';
import { cn } from '@/lib/utils';

const steps = [
  {
    number: '01',
    title: 'Fund',
    headline: 'Deposit from anywhere',
    description:
      'Deposit via M-Pesa, bank transfer, or crypto. Onboard in minutes with a seamless KYC flow — start moving money the same day.',
    icon: Wallet,
    accentColor: 'emerald',
    gradient: 'from-emerald/15 via-emerald/5 to-transparent',
    extra: MpesaIcon,
    extraLabel: 'M-Pesa supported',
  },
  {
    number: '02',
    title: 'Convert',
    headline: 'Swap any asset instantly',
    description:
      'Swap between KES, USD, BTC, USDC, and USDT at competitive institutional-grade rates. Every asset is one tap from every other asset.',
    icon: ArrowLeftRight,
    accentColor: 'gold',
    gradient: 'from-gold/15 via-gold/5 to-transparent',
  },
  {
    number: '03',
    title: 'Hold',
    headline: 'Multi-currency vault',
    description:
      'Store value across five currencies in your unified wallet system. Multi-currency balances in one account — always accessible, always secure.',
    icon: ShieldCheck,
    accentColor: 'cyan',
    gradient: 'from-cyan/15 via-cyan/5 to-transparent',
  },
  {
    number: '04',
    title: 'Spend & Invest',
    headline: 'Cards, markets, freedom',
    description:
      'Pay globally with premium cards funded from any wallet. Invest in U.S. stock markets with fractional shares — all from your Koya account.',
    icon: CreditCard,
    accentColor: 'gold',
    gradient: 'from-gold/15 via-gold/5 to-transparent',
  },
];

const AUTO_CYCLE_MS = 5000;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    setActive((prev) => (prev + 1) % steps.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(advance, AUTO_CYCLE_MS);
    return () => clearInterval(timer);
  }, [paused, advance]);

  const handleSelect = (idx: number) => {
    setActive(idx);
    setPaused(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => setPaused(false), AUTO_CYCLE_MS * 2);
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % steps.length;
      handleSelect(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + steps.length) % steps.length;
      handleSelect(prev);
    }
  };

  const current = steps[active]!;
  const CurrentIcon = current.icon;

  return (
    <SectionShell id="how-it-works" bg="surface">
      {/* Section header */}
      <div className="mb-16 text-center">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase text-gold">
          How It Works
        </p>
        <h2 className="font-display text-3xl font-bold text-white-95 sm:text-4xl lg:text-5xl">
          Simple by design
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white-40">
          Four steps from funding to spending — across any currency, any border.
        </p>
      </div>

      {/* ── Desktop layout ───────────────────────────────────────── */}
      <div className="hidden md:block">
        {/* Timeline track */}
        <div className="relative mx-auto mb-14 max-w-3xl px-8">
          {/* Background track */}
          <div className="absolute top-7 right-12 left-12 h-[2px] rounded-full bg-white-5" />

          {/* Animated progress fill */}
          <motion.div
            className="absolute top-7 left-12 h-[2px] rounded-full"
            style={{
              background: 'linear-gradient(90deg, #D4AF37, #F0D060)',
            }}
            animate={{ width: `${(active / (steps.length - 1)) * (100 - 14)}%` }}
            transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          />

          {/* Step nodes */}
          <div
            className="relative flex justify-between"
            role="tablist"
            aria-label="How it works steps"
          >
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = idx === active;
              const isPast = idx < active;

              return (
                <button
                  key={step.number}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`hiw-panel-${idx}`}
                  id={`hiw-tab-${idx}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleSelect(idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  className="group flex flex-col items-center gap-3 focus:outline-none focus-visible:outline-none"
                >
                  {/* Node circle */}
                  <div className="relative">
                    <motion.div
                      className={cn(
                        'relative flex h-14 w-14 items-center justify-center rounded-full border-2 transition-colors duration-300',
                        isActive
                          ? 'border-gold bg-gold/12'
                          : isPast
                            ? 'border-gold/40 bg-gold/6'
                            : 'border-white-10 bg-white-5 group-hover:border-white-20 group-hover:bg-white-10',
                      )}
                      animate={isActive ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                      transition={
                        isActive
                          ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                          : { duration: 0.3 }
                      }
                    >
                      <StepIcon
                        size={22}
                        strokeWidth={1.5}
                        className={cn(
                          'transition-colors duration-300',
                          isActive
                            ? 'text-gold'
                            : isPast
                              ? 'text-gold/60'
                              : 'text-white-40 group-hover:text-white-60',
                        )}
                      />
                    </motion.div>

                    {/* Active glow ring */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{
                          boxShadow: '0 0 20px rgba(212,175,55,0.2), 0 0 40px rgba(212,175,55,0.08)',
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                      />
                    )}

                    {/* Ripple effect on active */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full border border-gold/20"
                        initial={{ scale: 1, opacity: 0.4 }}
                        animate={{ scale: 1.6, opacity: 0 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <div className="text-center">
                    <span
                      className={cn(
                        'block font-mono text-[10px] font-semibold transition-colors duration-300',
                        isActive ? 'text-gold' : 'text-white-20',
                      )}
                    >
                      Step {step.number}
                    </span>
                    <span
                      className={cn(
                        'block text-sm font-semibold transition-colors duration-300',
                        isActive
                          ? 'text-white-95'
                          : 'text-white-40 group-hover:text-white-60',
                      )}
                    >
                      {step.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="relative mx-auto max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              id={`hiw-panel-${active}`}
              role="tabpanel"
              aria-labelledby={`hiw-tab-${active}`}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                'overflow-hidden rounded-2xl border border-white-5 bg-gradient-to-br p-8',
                current.gradient,
              )}
            >
              <div className="flex items-start gap-6">
                {/* Icon block */}
                <motion.div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gold/10"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                >
                  <CurrentIcon size={28} strokeWidth={1.5} className="text-gold" />
                </motion.div>

                <div className="min-w-0">
                  <motion.p
                    className="mb-1 font-mono text-[10px] font-semibold tracking-wider uppercase text-gold/60"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    Step {current.number}
                  </motion.p>
                  <motion.h3
                    className="mb-1 font-display text-xl font-bold text-white-95"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                  >
                    {current.headline}
                  </motion.h3>
                  <motion.p
                    className="max-w-lg text-sm leading-relaxed text-white-60"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    {current.description}
                  </motion.p>

                  {current.extra && (
                    <motion.div
                      className="mt-4 flex items-center gap-2 rounded-lg bg-white-5/50 px-3 py-1.5 w-fit"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.25 }}
                    >
                      <current.extra size={16} />
                      <span className="text-xs font-medium text-white-40">
                        {current.extraLabel}
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Progress bar at bottom */}
              {!paused && (
                <motion.div
                  className="mt-6 h-[2px] rounded-full bg-gold/20"
                  initial={{ scaleX: 0, transformOrigin: 'left' }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: AUTO_CYCLE_MS / 1000, ease: 'linear' }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile layout: vertical step cards ───────────────────── */}
      <div className="md:hidden">
        <div
          className="flex flex-col gap-3"
          role="tablist"
          aria-label="How it works steps"
          aria-orientation="vertical"
        >
          {steps.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = idx === active;

            return (
              <div key={step.number}>
                {/* Step card trigger */}
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`hiw-mobile-panel-${idx}`}
                  id={`hiw-mobile-tab-${idx}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleSelect(idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-all duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/40',
                    isActive
                      ? 'border-gold/20 bg-gold/5'
                      : 'border-white-5 bg-white-5/30 active:bg-white-5/50',
                  )}
                >
                  {/* Step number + vertical line indicator */}
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300',
                        isActive ? 'bg-gold/15' : 'bg-white-5',
                      )}
                    >
                      <StepIcon
                        size={18}
                        strokeWidth={1.5}
                        className={cn(
                          'transition-colors duration-300',
                          isActive ? 'text-gold' : 'text-white-40',
                        )}
                      />
                    </div>
                  </div>

                  {/* Title area */}
                  <div className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block font-mono text-[10px] font-semibold transition-colors',
                        isActive ? 'text-gold' : 'text-white-20',
                      )}
                    >
                      Step {step.number}
                    </span>
                    <span
                      className={cn(
                        'block text-sm font-semibold transition-colors',
                        isActive ? 'text-white-95' : 'text-white-60',
                      )}
                    >
                      {step.title}
                    </span>
                  </div>

                  {/* Active indicator */}
                  <motion.div
                    className="h-1.5 w-1.5 rounded-full"
                    animate={{
                      backgroundColor: isActive
                        ? 'rgba(212,175,55,1)'
                        : 'rgba(255,255,255,0.1)',
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      id={`hiw-mobile-panel-${idx}`}
                      role="tabpanel"
                      aria-labelledby={`hiw-mobile-tab-${idx}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                      className="overflow-hidden"
                    >
                      <div className={cn(
                        'mt-2 rounded-xl border border-white-5 bg-gradient-to-br px-4 py-4',
                        step.gradient,
                      )}>
                        <p className="text-xs font-medium text-white-60 mb-1">{step.headline}</p>
                        <p className="text-sm leading-relaxed text-white-50">
                          {step.description}
                        </p>
                        {step.extra && (
                          <div className="mt-3 flex items-center gap-2">
                            <step.extra size={14} />
                            <span className="text-[10px] font-medium text-white-30">
                              {step.extraLabel}
                            </span>
                          </div>
                        )}

                        {/* Progress bar */}
                        {!paused && (
                          <motion.div
                            className="mt-3 h-[2px] rounded-full bg-gold/20"
                            initial={{ scaleX: 0, transformOrigin: 'left' }}
                            animate={{ scaleX: 1 }}
                            transition={{
                              duration: AUTO_CYCLE_MS / 1000,
                              ease: 'linear',
                            }}
                          />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}
