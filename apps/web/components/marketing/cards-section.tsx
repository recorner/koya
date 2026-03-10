'use client';

import { KoyaMark } from '@/components/marketing/koya-mark';
import { SectionShell } from '@/components/marketing/section-shell';
import { FadeUp } from '@/components/marketing/motion-wrapper';
import {
  Globe2,
  Snowflake,
  Smartphone,
  Zap,
} from 'lucide-react';

const features = [
  { icon: Globe2, label: 'Spend globally in 150+ countries' },
  { icon: Snowflake, label: 'Instant freeze & unfreeze' },
  { icon: Smartphone, label: 'Real-time push notifications' },
  { icon: Zap, label: 'Fund from any wallet — auto-convert' },
];

export function CardsSection() {
  return (
    <SectionShell id="cards">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Card visual */}
        <FadeUp className="flex items-center justify-center">
          <div className="relative">
            {/* Physical card mockup */}
            <div className="relative h-[220px] w-full max-w-[350px] overflow-hidden rounded-2xl border border-white-10 bg-gradient-to-br from-[#141415] via-[#0F0F10] to-[#0A0A0A] shadow-glass-strong sm:h-[240px] sm:max-w-[380px]">
              {/* Card content */}
              <div className="flex h-full flex-col justify-between p-7">
                {/* Top: logo */}
                <div className="flex items-center justify-between">
                  <KoyaMark size={32} id="card" />
                  <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-white-40">
                    Premium
                  </span>
                </div>

                {/* Card number */}
                <div className="font-mono text-lg tracking-[0.15em] text-white-60">
                  •••• •••• •••• 4821
                </div>

                {/* Bottom row */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[9px] tracking-[0.1em] uppercase text-white-20">
                      Card Holder
                    </p>
                    <p className="text-sm font-medium text-white-80">
                      KOYA MEMBER
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] tracking-[0.1em] uppercase text-white-20">
                      Expires
                    </p>
                    <p className="font-mono text-sm text-white-80">09/29</p>
                  </div>
                </div>
              </div>

              {/* Subtle gold edge glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-30" style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, transparent 50%)',
              }} />
            </div>

            {/* Virtual card (offset behind) */}
            <div className="absolute -right-4 -bottom-4 -z-10 h-[220px] w-full max-w-[350px] rounded-2xl border border-white-5 bg-cell/80 opacity-50 blur-[1px] sm:h-[240px] sm:max-w-[380px]" />
          </div>
        </FadeUp>

        {/* Card info */}
        <FadeUp delay={0.15}>
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase text-gold">
            Koya Cards
          </p>
          <h2 className="font-display text-3xl font-bold text-white-95 sm:text-4xl">
            Premium cards for a borderless life
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white-40">
            Physical and virtual cards that spend from any wallet in your account.
            Fund with crypto, pay in local currency — wherever you are.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.label} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white-5 text-gold">
                    <Icon size={16} strokeWidth={1.5} />
                  </div>
                  <span className="text-sm text-white-60">{feat.label}</span>
                </div>
              );
            })}
          </div>
        </FadeUp>
      </div>
    </SectionShell>
  );
}
