'use client';

import { LockKeyhole, Radar, Scale, ShieldCheck } from 'lucide-react';
import { SectionShell } from '@/components/marketing/section-shell';
import { StaggerContainer, StaggerItem } from '@/components/marketing/motion-wrapper';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

const controls = [
  {
    icon: LockKeyhole,
    title: 'Encrypted data lifecycle',
    description: 'Sensitive user and payment data is encrypted in transit and at rest with strict access controls.',
  },
  {
    icon: ShieldCheck,
    title: 'Operational safeguards',
    description: 'Critical workflows are guarded by policy controls designed for financial operations.',
  },
  {
    icon: Radar,
    title: 'Continuous monitoring',
    description: 'Transaction and session signals are monitored for anomalies before settlement finalization.',
  },
  {
    icon: Scale,
    title: 'Compliance workflow',
    description: 'Verification and risk checks are integrated into the product journey, not bolted on later.',
  },
];

export function SecuritySection({ content }: { content?: MarketingSectionContent }) {
  return (
    <SectionShell id="security" bg="surface">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{content?.badge || 'Security'}</p>
        <h2 className="mt-3 font-display text-3xl tracking-tight text-white-95 sm:text-4xl md:text-5xl">
          {content?.heading || 'Controls that match real financial responsibility.'}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
          {content?.subheading ||
            'Koya is engineered with layered safeguards so user funds, data, and transaction integrity remain protected under load.'}
        </p>
      </div>

      <div className="mt-10 rounded-xl border border-white/12 bg-[#141414] p-6">
        <p className="text-sm leading-7 text-white/66">
          Security is treated as product infrastructure. Every conversion action, identity checkpoint, and settlement event is captured with audit intent.
        </p>
      </div>

      <StaggerContainer className="mt-5 grid gap-3 sm:grid-cols-2">
        {controls.map((control) => {
          const Icon = control.icon;
          return (
            <StaggerItem key={control.title}>
              <article className="rounded-lg border border-white/10 bg-[#121212] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-gold/35 bg-gold/10 text-gold">
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-white-95">{control.title}</h3>
                <p className="mt-2 text-sm leading-7 text-white/58">{control.description}</p>
              </article>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </SectionShell>
  );
}
