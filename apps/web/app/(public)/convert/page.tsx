import { Suspense } from 'react';
import { Metadata } from 'next';
import { ConversionWizard } from '@/components/conversion/conversion-wizard';
import { getWhatsAppPreviewLink } from '@/lib/cms';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  if (params.ref) {
    // Try to load CMS-managed preview metadata for WhatsApp link previews
    const preview = await getWhatsAppPreviewLink('convert_tracking');
    const title = preview?.og_title ?? 'Track Your Koya Conversion';
    const description =
      preview?.og_description ??
      'View real-time status of your KES → BTC conversion on Koya.';
    const image = preview?.og_image ?? null;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        ...(image ? { images: [{ url: image }] } : {}),
      },
    };
  }
  return {
    title: 'Convert KES to BTC',
    description:
      'Convert Kenyan Shillings to Bitcoin instantly via M-Pesa. No account required.',
  };
}

export default function ConvertPage() {
  return (
    <section className="relative min-h-[calc(100dvh-4rem)] px-4 py-6 sm:py-16 md:py-24">

      <div className="relative mx-auto max-w-7xl">
        {/* Header — compact on mobile so wizard fits in viewport */}
        <div className="mb-4 text-center sm:mb-10 md:mb-14">
          <div className="mb-2 hidden items-center justify-center gap-2 sm:inline-flex">
            <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                Guest Conversion
              </span>
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Send KES, receive BTC
          </h1>
          <p className="mx-auto mt-1.5 hidden max-w-md text-sm leading-relaxed text-white/45 sm:mt-3 sm:block">
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
