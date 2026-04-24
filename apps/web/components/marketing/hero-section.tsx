'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, CreditCard, Globe2, Landmark, Wallet } from 'lucide-react';
import { KoyaMark, KoyaWordmark } from '@/components/marketing/koya-mark';
import { Button } from '@/components/ui/button';
import { BtcIcon, KesIcon, UsdcIcon, UsdIcon } from '@/components/marketing/asset-icons';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

function PremiumCardSurface() {
  return (
    <div className="relative aspect-[1.586/1] w-full overflow-hidden rounded-xl border border-white/12 bg-[linear-gradient(145deg,#141414_0%,#0f0f0f_60%,#171717_100%)] shadow-[0_34px_90px_rgba(0,0,0,0.55)]">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(200,150,60,0.5),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(130deg,transparent_0%,rgba(255,255,255,0.04)_36%,transparent_70%)]" />
      <div className="absolute inset-0 p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <KoyaWordmark markSize={18} textSize="text-sm" id="hero-premium-card" />
          <span className="rounded-md border border-white/14 bg-white/[0.03] px-2 py-0.5 text-[9px] tracking-[0.16em] uppercase text-white/55">
            Black Reserve
          </span>
        </div>

        <div className="mt-10 sm:mt-12">
          <p className="font-mono text-sm tracking-[0.26em] text-white/85 sm:text-base">•••• •••• •••• 4821</p>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-white/30">Wallet rails</p>
            <div className="mt-1 flex items-center gap-1.5">
              <KesIcon size={14} />
              <UsdIcon size={14} />
              <BtcIcon size={14} />
              <UsdcIcon size={14} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.14em] text-white/30">Expiry</p>
            <p className="mt-1 font-mono text-[11px] text-white/75">09/29</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const features = [
  { icon: Wallet, label: 'Fund from M-Pesa', detail: 'Local entry, global utility.' },
  { icon: Landmark, label: 'Convert with live pricing', detail: 'Clear quotes before execution.' },
  { icon: CreditCard, label: 'Spend from wallet balances', detail: 'One system for hold and spend.' },
  { icon: Globe2, label: 'Operate across borders', detail: 'Built in Kenya, designed for global money.' },
] as const;

export function HeroSection({ content }: { content?: MarketingSectionContent }) {
  const badge = content?.badge || 'Premium Borderless Finance';
  const heading = content?.heading || 'Fund via M-Pesa. Convert with precision. Spend globally.';
  const subheading =
    content?.subheading ||
    'Koya brings funding, conversion, multi-currency wallets, and card spending into one institutional-grade experience.';

  const primaryCta = content?.cta || { label: 'Start conversion', href: '/convert' };
  const secondaryCta = content?.secondaryCta || { label: 'See conversion flow', href: '#how-it-works' };

  return (
    <section className="relative border-b border-white/8 bg-vault-black">
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:120px_120px]" />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-6 pb-14 pt-8 lg:grid-cols-[1fr_440px] lg:items-center lg:px-10 lg:pb-20 lg:pt-12">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-md border border-white/14 bg-[#111111] px-3 py-1.5">
            <KoyaMark size={14} id="hero-badge" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-gold">{badge}</span>
          </div>

          <h1 className="mt-5 font-display text-4xl leading-[1.03] tracking-tight text-white-95 sm:text-5xl lg:text-6xl">
            {heading}
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-white/64">{subheading}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link href={primaryCta.href}>
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-2 sm:grid-cols-2">
            {features.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-lg border border-white/10 bg-[#111111] p-3.5">
                  <div className="flex items-center gap-2 text-white/86">
                    <Icon className="h-4 w-4 text-gold" />
                    <p className="text-sm font-semibold">{item.label}</p>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-white/56">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mx-auto w-full max-w-[430px]"
        >
          <PremiumCardSurface />
          <div className="mt-3 rounded-lg border border-white/10 bg-[#111111] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/42">Conversion interaction</p>
            <p className="mt-1 text-sm text-white/64">
              Use the live conversion module below to preview KES to BTC quotes before entering the secure flow.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
