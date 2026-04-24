'use client';

import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KoyaMark } from '@/components/marketing/koya-mark';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

export function FinalCTA({ content }: { content?: MarketingSectionContent }) {
  const heading = content?.heading || 'Move from local liquidity to global financial control.';
  const subheading =
    content?.subheading ||
    'Start a conversion in seconds, then continue inside one account system designed for institutional clarity.';
  const badge = content?.badge || 'Begin with /convert';

  const cta = content?.cta || { label: 'Start conversion', href: '/convert' };
  const secondary = content?.secondaryCta || { label: 'Contact Koya', href: 'mailto:hello@koya.finance' };

  return (
    <section className="border-t border-white/10 bg-[#0d0d0d] py-20 md:py-24">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <div className="rounded-xl border border-white/12 bg-[#151515] p-7 shadow-[0_30px_90px_rgba(0,0,0,0.55)] sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-md border border-white/14 bg-[#101010] px-3 py-1.5">
            <KoyaMark size={14} id="final-cta" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-gold">{badge}</span>
          </div>

          <h2 className="mt-6 font-display text-3xl tracking-tight text-white-95 sm:text-4xl md:text-5xl">{heading}</h2>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-white/62 sm:text-base">{subheading}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <a href={cta.href}>
                {cta.label}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={secondary.href}>{secondary.label}</a>
            </Button>
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-md border border-white/10 bg-[#101010] px-3 py-2.5 text-xs text-white/58">
            <ShieldCheck className="h-4 w-4 text-gold" />
            Guest conversion flow remains encrypted, tracked, and compliance-screened.
          </div>
        </div>
      </div>
    </section>
  );
}
