'use client';

import { CreditCard, Globe2, ShieldCheck, Snowflake, Smartphone } from 'lucide-react';
import { SectionShell } from '@/components/marketing/section-shell';
import { FadeUp } from '@/components/marketing/motion-wrapper';
import { KoyaWordmark } from '@/components/marketing/koya-mark';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

const features = [
  {
    icon: Globe2,
    title: 'Global merchant acceptance',
    description: 'Use one premium card across international commerce contexts and travel surfaces.',
  },
  {
    icon: Snowflake,
    title: 'Instant controls',
    description: 'Freeze or unfreeze the card directly from your account controls in seconds.',
  },
  {
    icon: Smartphone,
    title: 'Live transaction trace',
    description: 'Receive immediate visibility when money moves through card activity.',
  },
  {
    icon: ShieldCheck,
    title: 'Controlled funding logic',
    description: 'Choose wallet funding behavior with explicit conversion and spending rules.',
  },
];

function PremiumCard() {
  return (
    <div className="relative mx-auto aspect-[1.586/1] w-full max-w-[480px] overflow-hidden rounded-xl border border-white/12 bg-[linear-gradient(150deg,#151515_0%,#101010_55%,#1b1b1b_100%)] shadow-[0_32px_90px_rgba(0,0,0,0.55)]">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(200,150,60,0.45),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_5%,rgba(255,255,255,0.04)_40%,transparent_72%)]" />

      <div className="relative flex h-full flex-col justify-between p-6">
        <div className="flex items-center justify-between">
          <KoyaWordmark markSize={22} textSize="text-lg" id="cards-section" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/38">Institutional tier</span>
        </div>

        <div className="mt-6 font-mono text-base tracking-[0.28em] text-white/84 sm:text-xl">•••• •••• •••• 4821</div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-white/30">Funding wallet</p>
            <p className="mt-1 text-sm text-white/80">USD Account</p>
          </div>

          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.14em] text-white/30">Expiry</p>
            <p className="mt-1 font-mono text-[12px] text-white/72">09/29</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardsSection({ content }: { content?: MarketingSectionContent }) {
  return (
    <SectionShell id="cards">
      <div className="grid items-center gap-10 lg:grid-cols-12">
        <FadeUp className="lg:col-span-6">
          <PremiumCard />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-white/12 bg-[#121212] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Control state</p>
              <p className="mt-1 text-sm text-white/74">Card active with immediate freeze controls.</p>
            </div>
            <div className="rounded-md border border-white/12 bg-[#121212] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Settlement</p>
              <p className="mt-1 text-sm text-white/74">Wallet-linked settlement in real time.</p>
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={0.12} className="lg:col-span-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{content?.badge || 'Koya Cards'}</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-white-95 sm:text-4xl md:text-5xl">
            {content?.heading || 'One card layer connected to your wallet system.'}
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
            {content?.subheading ||
              'Spend through a premium card surface while retaining explicit control over which balance is used and how conversions are applied.'}
          </p>

          <div className="mt-7 space-y-2.5">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="rounded-lg border border-white/10 bg-[#121212] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-gold/35 bg-gold/10 text-gold">
                      <Icon size={16} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white/88">{feature.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-white/56">{feature.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-md border border-white/10 bg-[#111111] px-3 py-2.5 text-sm text-white/62">
            <CreditCard className="h-4 w-4 text-gold" />
            Card behavior remains accountable to the same conversion and wallet engine.
          </div>
        </FadeUp>
      </div>
    </SectionShell>
  );
}
