'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CreditCard, Wallet, ArrowLeftRight, ShieldCheck } from 'lucide-react';
import { SectionShell } from '@/components/marketing/section-shell';
import { cn } from '@/lib/utils';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

type Step = {
  id: string;
  title: string;
  headline: string;
  description: string;
  signal: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

const defaults: Step[] = [
  {
    id: '01',
    title: 'Fund',
    headline: 'Start from familiar local rails.',
    description: 'Move value into Koya using M-Pesa and mapped wallet rails built for local behavior.',
    signal: 'M-Pesa aligned onboarding',
    icon: Wallet,
  },
  {
    id: '02',
    title: 'Convert',
    headline: 'Review quotes before execution.',
    description: 'Conversion remains explicit: input, output, pricing, and timing are visible before confirmation.',
    signal: 'Transparent quote windows',
    icon: ArrowLeftRight,
  },
  {
    id: '03',
    title: 'Secure',
    headline: 'Operate under controlled safeguards.',
    description: 'Identity, compliance checks, and account protections are integrated into the normal transaction flow.',
    signal: 'Compliance and auditability',
    icon: ShieldCheck,
  },
  {
    id: '04',
    title: 'Deploy',
    headline: 'Spend or move value outward.',
    description: 'Card spending and outbound financial actions stay connected to the same wallet and history model.',
    signal: 'Unified card and wallet layer',
    icon: CreditCard,
  },
];

function normalizeSteps(items?: Record<string, unknown>[]): Step[] {
  if (!items?.length) return defaults;

  return defaults.map((fallback, idx) => {
    const item = items[idx];
    return {
      ...fallback,
      id: typeof item?.id === 'string' ? item.id : fallback.id,
      title: typeof item?.title === 'string' ? item.title : fallback.title,
      headline: typeof item?.headline === 'string' ? item.headline : fallback.headline,
      description: typeof item?.description === 'string' ? item.description : fallback.description,
      signal: typeof item?.signal === 'string' ? item.signal : fallback.signal,
    };
  });
}

export function HowItWorks({ content }: { content?: MarketingSectionContent }) {
  const steps = normalizeSteps(content?.items);
  const [active, setActive] = useState(0);

  const advance = useCallback(() => {
    setActive((prev) => (prev + 1) % steps.length);
  }, [steps.length]);

  useEffect(() => {
    const id = setInterval(advance, 7000);
    return () => clearInterval(id);
  }, [advance]);

  const fallbackStep: Step = {
    id: '01',
    title: 'Fund',
    headline: 'Start from familiar local rails.',
    description: 'Move value into Koya using M-Pesa and mapped wallet rails built for local behavior.',
    signal: 'M-Pesa aligned onboarding',
    icon: Wallet,
  };
  const current = steps[active] ?? defaults.at(0) ?? fallbackStep;

  return (
    <SectionShell id="how-it-works" bg="cell">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{content?.badge || 'How It Works'}</p>
        <h2 className="mt-3 font-display text-3xl tracking-tight text-white-95 sm:text-4xl lg:text-5xl">
          {content?.heading || 'A clear path from local funding to global utility.'}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
          {content?.subheading ||
            'Koya keeps each stage explicit so users can understand where value is, how it moves, and what happens next.'}
        </p>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === active;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                'rounded-lg border p-4 text-left transition-colors',
                isActive ? 'border-gold/50 bg-[#171717]' : 'border-white/10 bg-[#111111] hover:border-white/18',
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/14 bg-[#0f0f0f] text-gold">
                  <Icon size={16} />
                </div>
                <span className="font-mono text-[10px] tracking-[0.14em] text-white/36">STEP {step.id}</span>
              </div>
              <p className="mt-4 text-base font-semibold text-white/88">{step.title}</p>
              <p className="mt-1 text-xs text-white/46">{step.signal}</p>
            </button>
          );
        })}
      </div>

      <motion.div
        key={current.id}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mt-5 rounded-xl border border-white/12 bg-[#141414] p-6"
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-gold">Step {current.id}</p>
        <h3 className="mt-2 font-display text-2xl tracking-tight text-white-95">{current.headline}</h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/62">{current.description}</p>

        <button
          type="button"
          onClick={advance}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
        >
          Next stage
          <ArrowRight className="h-4 w-4 text-gold" />
        </button>
      </motion.div>
    </SectionShell>
  );
}
