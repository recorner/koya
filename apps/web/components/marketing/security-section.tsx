'use client';

import { SectionShell } from '@/components/marketing/section-shell';
import { StaggerContainer, StaggerItem } from '@/components/marketing/motion-wrapper';

const attributes = [
  {
    accent: 'bg-emerald',
    title: 'End-to-End Encryption',
    description: 'TLS 1.3 in transit. AES-256 at rest. Zero plaintext storage of sensitive data.',
  },
  {
    accent: 'bg-cyan',
    title: 'Multi-Signature Custody',
    description: 'Crypto assets secured with MPC wallets, HSM signing, and geographically distributed key shards.',
  },
  {
    accent: 'bg-emerald',
    title: 'Real-Time Monitoring',
    description: 'Every transaction scored for risk in real time. Anomalies flagged before they settle.',
  },
  {
    accent: 'bg-cyan',
    title: 'Regulatory Compliance',
    description: 'KYC/AML pipeline with tiered verification. Sanctions screening on every transaction.',
  },
  {
    accent: 'bg-emerald',
    title: 'Immutable Ledger',
    description: 'Double-entry accounting with atomic operations. Every movement of value is auditable.',
  },
  {
    accent: 'bg-cyan',
    title: 'Fraud Prevention',
    description: 'Device fingerprinting, velocity checks, and behavioral analysis protect every account.',
  },
];

export function SecuritySection() {
  return (
    <SectionShell id="security" bg="navy">
      <div className="mb-14 text-center">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase text-gold">
          Security
        </p>
        <h2 className="font-display text-3xl font-bold text-white-95 sm:text-4xl">
          Built for institutional trust
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base text-white-40">
          Financial infrastructure demands more than promises. Koya is engineered
          with the security posture of systems that move real money.
        </p>
      </div>

      <StaggerContainer
        stagger={0.08}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {attributes.map((attr) => (
          <StaggerItem key={attr.title}>
            <div className="flex h-full flex-col gap-3 rounded-xl border border-white-5 bg-white-5/30 p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className={`h-1.5 w-1.5 rounded-full ${attr.accent}`} />
                <h3 className="text-sm font-semibold text-white-95">
                  {attr.title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-white-40">
                {attr.description}
              </p>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </SectionShell>
  );
}
