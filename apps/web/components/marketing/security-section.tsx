'use client';

import {
  ShieldCheck,
  LockKeyhole,
  Radar,
  Scale,
  DatabaseZap,
  Fingerprint,
  ArrowUpRight,
} from 'lucide-react';
import { SectionShell } from '@/components/marketing/section-shell';
import {
  StaggerContainer,
  StaggerItem,
} from '@/components/marketing/motion-wrapper';

const controls = [
  {
    icon: LockKeyhole,
    eyebrow: 'Data security',
    title: 'Encryption across critical surfaces',
    description:
      'Sensitive data is protected in transit and at rest, with tighter handling around credentials, tokens, and financial operations.',
    points: ['Encrypted transport', 'Protected storage', 'Sensitive data minimization'],
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Custody controls',
    title: 'Layered protection for stored value',
    description:
      'Wallet and account protections are designed to reduce single points of failure and tighten authorization around high-risk actions.',
    points: ['Access controls', 'Signing controls', 'Operational separation'],
  },
  {
    icon: Radar,
    eyebrow: 'Live defense',
    title: 'Real-time monitoring and anomaly detection',
    description:
      'Transactions, sessions, and account behavior can be observed continuously so suspicious activity is surfaced before it becomes expensive.',
    points: ['Activity scoring', 'Risk signals', 'Escalation paths'],
  },
  {
    icon: Scale,
    eyebrow: 'Compliance posture',
    title: 'Verification and regulatory guardrails',
    description:
      'Identity, sanctions, and transaction review flows help support a more defensible operating model as the platform scales.',
    points: ['KYC workflows', 'Screening checks', 'Review controls'],
  },
  {
    icon: DatabaseZap,
    eyebrow: 'Ledger integrity',
    title: 'Auditable movement of value',
    description:
      'Financial events should be recorded with strong consistency so balances, transfers, and settlement paths remain explainable.',
    points: ['Traceable entries', 'Balance integrity', 'Audit readiness'],
  },
  {
    icon: Fingerprint,
    eyebrow: 'Fraud prevention',
    title: 'Behavioral and device-level protection',
    description:
      'Signals from devices, sessions, and transaction patterns can be used to identify abuse, account takeover risk, and unusual behavior.',
    points: ['Device signals', 'Velocity checks', 'Behavior analysis'],
  },
];

export function SecuritySection() {
  return (
    <SectionShell id="security" bg="navy">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(212,175,55,0.95)]">
          Security architecture
        </p>

        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          Built to move real money
          <span className="block bg-[linear-gradient(180deg,#F0D060_0%,#D4AF37_48%,#A88520_100%)] bg-clip-text text-transparent">
            with institutional discipline
          </span>
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/56 sm:text-base">
          Security at Koya should not be a decorative claim. It should show up in
          how accounts are protected, how activity is monitored, how value is
          recorded, and how risky actions are controlled.
        </p>
      </div>

      <div className="mt-14 grid gap-5 lg:grid-cols-12">
        {/* Featured anchor card */}
        <div className="lg:col-span-5">
          <div className="relative h-full overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-7 shadow-[0_22px_80px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[rgba(212,175,55,0.10)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-28 rounded-full bg-[rgba(0,229,255,0.06)] blur-2xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
                <ShieldCheck className="h-4 w-4 text-[rgba(212,175,55,0.95)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">
                  Hardened operating model
                </span>
              </div>

              <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Security is part of the product,
                <span className="block text-white/70">not a footer promise.</span>
              </h3>

              <p className="mt-5 max-w-lg text-sm leading-7 text-white/58">
                The platform should be designed so protection exists across the full
                lifecycle of money movement: access, authorization, monitoring,
                ledger integrity, and compliance controls.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  'Protected account and wallet access',
                  'Continuous monitoring of activity and risk',
                  'Auditable financial event trails',
                  'Stronger controls for sensitive operations',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
                  >
                    <span className="text-sm text-white/74">{item}</span>
                    <ArrowUpRight className="h-4 w-4 text-[rgba(212,175,55,0.80)]" />
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-[24px] border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                  Trust principle
                </div>
                <p className="mt-2 text-sm leading-6 text-white/66">
                  Reduce single points of failure. Limit unnecessary exposure.
                  Record what matters. Escalate what looks wrong.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Supporting control cards */}
        <div className="lg:col-span-7">
          <StaggerContainer
            stagger={0.08}
            className="grid gap-4 sm:grid-cols-2"
          >
            {controls.map((control) => {
              const Icon = control.icon;

              return (
                <StaggerItem key={control.title}>
                  <div className="group relative h-full overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] p-6 shadow-[0_16px_55px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(212,175,55,0.20)] hover:shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                      <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[rgba(212,175,55,0.08)] blur-3xl" />
                    </div>

                    <div className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.16)] bg-[rgba(212,175,55,0.10)] text-[rgba(212,175,55,0.95)]">
                          <Icon size={22} strokeWidth={1.7} />
                        </div>

                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">
                          {control.eyebrow}
                        </span>
                      </div>

                      <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">
                        {control.title}
                      </h3>

                      <p className="mt-3 text-sm leading-7 text-white/56">
                        {control.description}
                      </p>

                      <div className="mt-5 space-y-2">
                        {control.points.map((point) => (
                          <div
                            key={point}
                            className="rounded-2xl border border-white/6 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/70"
                          >
                            {point}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>
      </div>
    </SectionShell>
  );
}