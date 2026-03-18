'use client';

import {
  Globe,
  ArrowLeftRight,
  CreditCard,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';
import {
  StaggerContainer,
  StaggerItem,
} from '@/components/marketing/motion-wrapper';

const pillars = [
  {
    icon: Globe,
    label: 'Multi-currency wallets',
    detail: 'KES, USD, BTC, USDC, USDT',
  },
  {
    icon: ArrowLeftRight,
    label: 'Instant conversion',
    detail: 'Swap currencies at live rates',
  },
  {
    icon: CreditCard,
    label: 'Premium cards',
    detail: 'Spend from any wallet, anywhere',
  },
  {
    icon: TrendingUp,
    label: 'Global investing',
    detail: 'Buy U.S. stocks and ETFs',
  },
  {
    icon: ShieldCheck,
    label: 'Bank-grade security',
    detail: 'Encrypted, monitored, compliant',
  },
];

export function TrustStrip() {
  return (
    <section className="relative border-y border-white/6 bg-[linear-gradient(180deg,#0A0A0A_0%,#0D0D0D_100%)] py-12 md:py-14">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(212,175,55,0.95)]">
            Koya platform
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/50">
            Everything you need to manage money across currencies, borders, and
            asset classes — in one account.
          </p>
        </div>

        <StaggerContainer
          stagger={0.07}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          {pillars.map((item) => {
            const Icon = item.icon;

            return (
              <StaggerItem key={item.label}>
                <div className="group relative h-full overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] p-5 shadow-[0_14px_45px_rgba(0,0,0,0.20)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(212,175,55,0.18)] hover:shadow-[0_22px_60px_rgba(0,0,0,0.30)]">
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[rgba(212,175,55,0.08)] blur-3xl" />
                  </div>

                  <div className="relative">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.14)] bg-[rgba(212,175,55,0.10)] text-[rgba(212,175,55,0.95)]">
                      <Icon size={18} strokeWidth={1.7} />
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold tracking-tight text-white">
                        {item.label}
                      </p>
                      <p className="text-xs leading-5 text-white/50">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </section>
  );
}