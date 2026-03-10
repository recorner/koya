'use client';

import {
  ArrowLeftRight,
  Wallet,
  CreditCard,
  LineChart,
} from 'lucide-react';
import { SectionShell } from '@/components/marketing/section-shell';
import { StaggerContainer, StaggerItem } from '@/components/marketing/motion-wrapper';

const pillars = [
  {
    icon: ArrowLeftRight,
    title: 'Convert',
    description:
      'Swap between KES, USD, BTC, and stablecoins with institutional-grade pricing. Every asset is one tap from every other asset.',
  },
  {
    icon: Wallet,
    title: 'Hold',
    description:
      'Multi-currency wallets in a single system. Hold Kenyan shillings, dollars, Bitcoin, USDC, and USDT — all in one place.',
  },
  {
    icon: CreditCard,
    title: 'Spend',
    description:
      'Premium physical and virtual cards that spend from any wallet. Fund in crypto, pay in fiat — globally, instantly.',
  },
  {
    icon: LineChart,
    title: 'Invest',
    description:
      'Access U.S. stock markets with fractional shares. Buy Apple, Tesla, or S&P 500 ETFs from your Koya account.',
  },
];

export function ProductPillars() {
  return (
    <SectionShell id="products">
      <div className="mb-12 text-center">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase text-gold">
          Platform
        </p>
        <h2 className="font-display text-3xl font-bold text-white-95 sm:text-4xl">
          Everything your money needs
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base text-white-40">
          Four capabilities. One account. No boundaries.
        </p>
      </div>

      <StaggerContainer
        stagger={0.1}
        className="grid gap-4 sm:grid-cols-2"
      >
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <StaggerItem key={pillar.title}>
              <div className="group glass flex h-full flex-col gap-4 rounded-2xl p-8 transition-all duration-300 hover:shadow-gold">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10 text-gold transition-colors group-hover:bg-gold/20">
                  <Icon size={22} strokeWidth={1.5} />
                </div>
                <h3 className="font-display text-xl font-bold text-white-95">
                  {pillar.title}
                </h3>
                <p className="text-sm leading-relaxed text-white-40">
                  {pillar.description}
                </p>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </SectionShell>
  );
}
