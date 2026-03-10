'use client';

import {
  Globe,
  ArrowLeftRight,
  CreditCard,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';
import { StaggerContainer, StaggerItem } from '@/components/marketing/motion-wrapper';

const pillars = [
  { icon: Globe, label: 'Multi-Currency', detail: '5 currencies' },
  { icon: ArrowLeftRight, label: 'Instant Conversion', detail: '< 2s swaps' },
  { icon: CreditCard, label: 'Premium Cards', detail: 'Physical & virtual' },
  { icon: TrendingUp, label: 'Global Investing', detail: 'U.S. markets' },
  { icon: ShieldCheck, label: 'Secure Infrastructure', detail: 'Bank grade' },
];

export function TrustStrip() {
  return (
    <section className="border-y border-white-5 bg-surface py-10 md:py-12">
      <StaggerContainer
        stagger={0.08}
        className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 sm:grid-cols-3 md:grid-cols-5 md:gap-4"
      >
        {pillars.map((item) => {
          const Icon = item.icon;
          return (
            <StaggerItem
              key={item.label}
              className="flex flex-col items-center gap-3 text-center"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white-5 text-gold">
                <Icon size={20} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white-95">{item.label}</p>
                <p className="font-mono text-[11px] text-white-40">{item.detail}</p>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </section>
  );
}
