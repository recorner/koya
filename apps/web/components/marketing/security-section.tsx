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
  GlowPulse,
} from '@/components/marketing/motion-wrapper';

const controls = [
  {
    icon: LockKeyhole,
    eyebrow: 'Data security',
    title: 'Your data is encrypted end to end',
    description:
      'Everything from your login credentials to financial activity is encrypted in transit and at rest — your information stays protected.',
    points: ['Encrypted connections', 'Secure storage', 'Minimal data collection'],
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Custody controls',
    title: 'Multiple layers protect your funds',
    description:
      'Your money is held with institutional-grade custody controls — no single point of failure, no shortcuts.',
    points: ['Segregated accounts', 'Multi-party signing', 'Cold storage'],
  },
  {
    icon: Radar,
    eyebrow: 'Live defense',
    title: 'We watch for suspicious activity 24/7',
    description:
      'Every transaction and session is monitored in real time so unusual activity is caught and flagged before it becomes a problem.',
    points: ['Real-time alerts', 'Risk scoring', 'Automatic escalation'],
  },
  {
    icon: Scale,
    eyebrow: 'Compliance',
    title: 'Identity verification and regulatory compliance',
    description:
      'KYC, sanctions screening, and transaction review are built in from day one — not bolted on later.',
    points: ['KYC verification', 'Sanctions screening', 'Transaction review'],
  },
  {
    icon: DatabaseZap,
    eyebrow: 'Ledger integrity',
    title: 'Every transaction is recorded and auditable',
    description:
      'Your balances, transfers, and conversions are recorded with full consistency — every shilling and satoshi is accounted for.',
    points: ['Full audit trail', 'Balance verification', 'Tamper-proof records'],
  },
  {
    icon: Fingerprint,
    eyebrow: 'Fraud prevention',
    title: 'Device and behavior checks block bad actors',
    description:
      'Signals from your devices, sessions, and usage patterns help us identify and stop account takeover attempts and fraud.',
    points: ['Device fingerprinting', 'Velocity limits', 'Behavior analysis'],
  },
];

export function SecuritySection() {
  return (
    <SectionShell id="security" bg="navy">
      <div className="relative mx-auto max-w-3xl text-center">
        <GlowPulse className="-top-20 left-1/2 h-60 w-60 -translate-x-1/2" color="rgba(0,229,255,0.10)" />
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(212,175,55,0.95)]">
          Security
        </p>

        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          How your money
          <span className="block bg-[linear-gradient(180deg,#F0D060_0%,#D4AF37_48%,#A88520_100%)] bg-clip-text text-transparent">
            is protected
          </span>
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/56 sm:text-base">
          Koya is built with the same security standards used by banks and
          institutional platforms — encryption, monitoring, custody controls,
          and compliance from the ground up.
        </p>
      </div>

      <div className="mt-14 grid gap-5 lg:grid-cols-12">
        {/* Featured anchor card */}
        <div className="lg:col-span-5">
          <div className="relative h-full overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-7 shadow-[0_22px_80px_rgba(0,0,0,0.30)] backdrop-blur-md">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[rgba(212,175,55,0.10)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-28 rounded-full bg-[rgba(0,229,255,0.06)] blur-2xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
                <ShieldCheck className="h-4 w-4 text-[rgba(212,175,55,0.95)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">
                  Security-first design
                </span>
              </div>

              <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Your protection is built in,
                <span className="block text-white/70">not bolted on.</span>
              </h3>

              <p className="mt-5 max-w-lg text-sm leading-7 text-white/58">
                Every layer of the platform — from login to settlement — is designed
                with protection in mind. Your accounts, your funds, and your data are
                guarded at every step.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  'Encrypted accounts and wallet access',
                  '24/7 monitoring of activity and risk',
                  'Full audit trail for every transaction',
                  'Stronger controls for high-value operations',
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
                  Our commitment
                </div>
                <p className="mt-2 text-sm leading-6 text-white/66">
                  Your funds are never commingled. Your data is never sold.
                  Your security is never optional.
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
                  <div className="group relative h-full overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] p-6 shadow-[0_16px_55px_rgba(0,0,0,0.22)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(212,175,55,0.20)] hover:shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
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