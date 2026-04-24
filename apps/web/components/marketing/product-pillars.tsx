'use client';

import { ArrowLeftRight, CreditCard, LineChart, Wallet } from 'lucide-react';
import { SectionShell } from '@/components/marketing/section-shell';
import { StaggerContainer, StaggerItem } from '@/components/marketing/motion-wrapper';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

const defaults = [
  {
    number: '01',
    icon: ArrowLeftRight,
    title: 'Convert with clear pricing',
    description: 'Move between KES, USD, BTC, and stablecoins with visible pricing and controlled execution windows.',
  },
  {
    number: '02',
    icon: Wallet,
    title: 'Hold multiple wallets',
    description: 'Keep currency balances distinct while managing them through one coherent portfolio experience.',
  },
  {
    number: '03',
    icon: CreditCard,
    title: 'Spend through one card layer',
    description: 'Card spending routes through your selected balance with transparent behavior across currencies.',
  },
  {
    number: '04',
    icon: LineChart,
    title: 'Deploy into global markets',
    description: 'Access international assets from the same operating account used for funding and conversion.',
  },
] as const;

function normalizeItems(items?: Record<string, unknown>[]) {
  if (!items?.length) return defaults;
  return defaults.map((fallback, index) => {
    const raw = items[index];
    return {
      ...fallback,
      title: typeof raw?.title === 'string' ? raw.title : fallback.title,
      description: typeof raw?.description === 'string' ? raw.description : fallback.description,
      number: typeof raw?.number === 'string' ? raw.number : fallback.number,
    };
  });
}

export function ProductPillars({ content }: { content?: MarketingSectionContent }) {
  const pillars = normalizeItems(content?.items);

  return (
    <SectionShell id="products" bg="surface">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{content?.badge || 'Platform Pillars'}</p>
        <h2 className="mt-3 font-display text-3xl tracking-tight text-white-95 sm:text-4xl md:text-5xl">
          {content?.heading || 'One financial operating system for funding, conversion, and deployment.'}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
          {content?.subheading ||
            'Koya is built as connected infrastructure, not disconnected features. Every action stays within one accountable system.'}
        </p>
      </div>

      <StaggerContainer className="mt-12 grid gap-4 md:grid-cols-2">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <StaggerItem key={pillar.title}>
              <article className="h-full rounded-lg border border-white/10 bg-[#131313] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-gold/35 bg-gold/10 text-gold">
                    <Icon size={18} />
                  </div>
                  <span className="font-mono text-xs tracking-[0.16em] text-white/34">{pillar.number}</span>
                </div>
                <h3 className="mt-5 font-display text-2xl tracking-tight text-white-95">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/58">{pillar.description}</p>
              </article>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </SectionShell>
  );
}
