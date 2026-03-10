'use client';

import { SectionShell } from '@/components/marketing/section-shell';
import { StaggerContainer, StaggerItem } from '@/components/marketing/motion-wrapper';

const steps = [
  {
    number: '01',
    title: 'Fund',
    description: 'Deposit via M-Pesa, bank transfer, or crypto. Onboard in minutes.',
  },
  {
    number: '02',
    title: 'Convert',
    description: 'Swap between KES, USD, BTC, USDC, and USDT at competitive rates.',
  },
  {
    number: '03',
    title: 'Hold',
    description: 'Store value across five currencies in your unified wallet system.',
  },
  {
    number: '04',
    title: 'Spend & Invest',
    description: 'Pay globally with premium cards or invest in U.S. markets.',
  },
];

export function HowItWorks() {
  return (
    <SectionShell id="how-it-works" bg="surface">
      <div className="mb-14 text-center">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase text-gold">
          How It Works
        </p>
        <h2 className="font-display text-3xl font-bold text-white-95 sm:text-4xl">
          Simple by design
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-white-40">
          Four steps from funding to spending — across any currency.
        </p>
      </div>

      <StaggerContainer
        stagger={0.12}
        className="relative grid gap-8 md:grid-cols-4 md:gap-6"
      >
        {/* Connecting line (desktop only) */}
        <div className="pointer-events-none absolute top-12 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-white-10 to-transparent md:block" />

        {steps.map((step) => (
          <StaggerItem key={step.number} className="relative text-center">
            {/* Number badge */}
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
              <span className="font-mono text-sm font-bold text-gradient-gold">
                {step.number}
              </span>
            </div>

            <h3 className="mb-2 font-display text-lg font-bold text-white-95">
              {step.title}
            </h3>
            <p className="mx-auto max-w-[220px] text-sm leading-relaxed text-white-40">
              {step.description}
            </p>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </SectionShell>
  );
}
