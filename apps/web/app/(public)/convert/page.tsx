import { Suspense } from 'react';
import { Metadata } from 'next';
import { ConversionWizard } from '@/components/conversion/conversion-wizard';

export const metadata: Metadata = {
  title: 'Convert KES to BTC',
  description:
    'Convert Kenyan Shillings to Bitcoin instantly via M-Pesa. No account required.',
};

export default function ConvertPage() {
  return (
    <section className="relative min-h-[calc(100dvh-4rem)] px-4 py-6 sm:py-16 md:py-24">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(212,175,55,0.06),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 text-center sm:mb-10 md:mb-14">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Guest Conversion
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Send KES, receive BTC
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/45">
            Convert Kenyan Shillings to Bitcoin using M-Pesa. No account
            required — just your phone and a BTC address.
          </p>
        </div>

        {/* Wizard */}
        <Suspense>
          <ConversionWizard />
        </Suspense>

        {/* Trust footer */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-[10px] uppercase tracking-[0.18em] text-white/25">
          <span>256-bit encryption</span>
          <span className="hidden sm:inline">•</span>
          <span>KYC verified</span>
          <span className="hidden sm:inline">•</span>
          <span>Guest limit: KES 100K/day</span>
        </div>
      </div>
    </section>
  );
}
