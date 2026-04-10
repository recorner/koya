'use client';

import {
  ArrowLeftRight,
  Wallet,
  CreditCard,
  LineChart,
  ArrowUpRight,
} from 'lucide-react';
import { SectionShell } from '@/components/marketing/section-shell';
import {
  StaggerContainer,
  StaggerItem,
  GlowPulse,
} from '@/components/marketing/motion-wrapper';

const pillars = [
  {
    number: '01',
    icon: ArrowLeftRight,
    title: 'Convert instantly',
    description:
      'Switch between KES, USD, BTC, USDC, and USDT at live rates — fast execution, transparent pricing, no hidden fees.',
    points: ['Live rates', 'M-Pesa deposits', 'Cross-currency swaps'],
  },
  {
    number: '02',
    icon: Wallet,
    title: 'Hold multiple currencies',
    description:
      'Keep shillings, dollars, Bitcoin, and stablecoins in one account instead of juggling separate apps and bank accounts.',
    points: ['Multi-currency wallets', 'Single portfolio view', 'Always accessible'],
  },
  {
    number: '03',
    icon: CreditCard,
    title: 'Spend anywhere',
    description:
      'Use a premium Koya card funded from any wallet — pay in KES locally or spend in USD abroad, with real-time notifications.',
    points: ['Virtual + physical cards', 'Any-wallet funding', 'Global acceptance'],
  },
  {
    number: '04',
    icon: LineChart,
    title: 'Invest globally',
    description:
      'Buy fractional U.S. stocks and ETFs from the same account you use to hold, convert, and spend your money.',
    points: ['Fractional shares', 'U.S. equities & ETFs', 'Wallet-funded investing'],
  },
];

export function ProductPillars() {
  return (
    <SectionShell id="products">
      <div className="relative mx-auto max-w-3xl text-center">
        <GlowPulse className="-top-20 left-1/2 h-60 w-60 -translate-x-1/2" />
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(212,175,55,0.95)]">
          Platform pillars
        </p>

        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          One account for how your money
          <span className="block bg-[linear-gradient(180deg,#F0D060_0%,#D4AF37_48%,#A88520_100%)] bg-clip-text text-transparent">
            moves, stays, spends, and grows
          </span>
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/56 sm:text-base">
          Deposit via M-Pesa, hold multiple currencies, convert instantly,
          spend with a premium card, and invest in global markets — all
          from one Koya account.
        </p>
      </div>

      <StaggerContainer
        stagger={0.1}
        className="mt-14 grid gap-5 md:grid-cols-2"
      >
        {pillars.map((pillar) => {
          const Icon = pillar.icon;

          return (
            <StaggerItem key={pillar.title}>
              <div
                className={[
                  'group relative h-full overflow-hidden rounded-[28px] border border-white/10',
                  'bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)]',
                  'p-7 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-sm',
                  'transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(212,175,55,0.22)]',
                  'hover:shadow-[0_28px_80px_rgba(0,0,0,0.42)]',
                ].join(' ')}
              >
                {/* ambient accent */}
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[rgba(212,175,55,0.10)] blur-3xl" />
                  <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-[rgba(0,229,255,0.06)] blur-2xl" />
                </div>

                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.16)] bg-[rgba(212,175,55,0.10)] text-[rgba(212,175,55,0.95)] transition-colors duration-300 group-hover:bg-[rgba(212,175,55,0.16)]">
                      <Icon size={22} strokeWidth={1.7} />
                    </div>

                    <div className="text-xs font-semibold tracking-[0.18em] text-white/28">
                      {pillar.number}
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-display text-2xl font-bold tracking-tight text-white">
                      {pillar.title}
                    </h3>

                    <p className="mt-4 max-w-md text-sm leading-7 text-white/56">
                      {pillar.description}
                    </p>
                  </div>

                  <div className="mt-6 space-y-2">
                    {pillar.points.map((point) => (
                      <div
                        key={point}
                        className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-3.5 py-3"
                      >
                        <span className="text-sm text-white/72">{point}</span>
                        <ArrowUpRight className="h-4 w-4 text-white/24 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[rgba(212,175,55,0.85)]" />
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-5">
                    <div className="h-px w-full bg-white/8" />
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/38">
                        Koya infrastructure
                      </span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/6">
                        <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,#A88520_0%,#D4AF37_55%,#F0D060_100%)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </SectionShell>
  );
}