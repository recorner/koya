import { Suspense } from 'react';
import { Metadata } from 'next';

import { ConversionWizard } from '@/components/conversion/conversion-wizard';
import {
  getWhatsAppPreviewLink,
  getPageBySlug,
  getSeoDefaults,
  getBranding,
} from '@/lib/cms';
import type { PageSection } from '@/lib/cms';

function extractTrustFooterItems(section: PageSection | undefined): string[] {
  if (!section?.items || !Array.isArray(section.items)) {
    return [];
  }

  return section.items
    .map((item) => (typeof item.label === 'string' ? item.label : null))
    .filter((item): item is string => Boolean(item));
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;

  if (params.ref) {
    const [previewByRef, previewFallback, branding] = await Promise.all([
      getWhatsAppPreviewLink(params.ref),
      getWhatsAppPreviewLink('convert_tracking'),
      getBranding(),
    ]);

    const preview = previewByRef || previewFallback;
    const title = preview?.og_title ?? 'Track Your Koya Conversion';
    const description =
      preview?.og_description ??
      'View real-time status of your KES → BTC conversion on Koya.';
    const image = preview?.og_image ?? branding?.og_default_image ?? null;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}),
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  }

  const [page, seo, branding] = await Promise.all([
    getPageBySlug('/convert'),
    getSeoDefaults(),
    getBranding(),
  ]);

  const title = page?.meta_title || 'Convert KES to BTC';
  const description =
    page?.meta_description ||
    seo?.fallback_description ||
    'Convert Kenyan Shillings to Bitcoin instantly via M-Pesa. No account required.';
  const ogImage =
    page?.og_image || branding?.og_default_image || seo?.fallback_og_image || null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function ConvertPage() {
  const page = await getPageBySlug('/convert');
  const sections = (page?.sections as PageSection[] | undefined) || [];

  const heroSection = sections.find((section) => section.section_type === 'swap_widget');
  const trustFooterSection = sections.find(
    (section) => section.section_type === 'trust_footer_items',
  );

  const heading = heroSection?.heading || 'Send KES, receive BTC';
  const subheading =
    heroSection?.subheading ||
    'Convert Kenyan Shillings to Bitcoin using M-Pesa. No account required — just your phone and a BTC address.';
  const badge = heroSection?.badge_text || 'Guest Conversion';

  const trustItems = extractTrustFooterItems(trustFooterSection);
  const fallbackTrustItems = [
    '256-bit encryption',
    'KYC verified',
    'Guest limit: KES 100K/day',
  ];

  const resolvedTrustItems = trustItems.length ? trustItems : fallbackTrustItems;

  return (
    <section className="relative min-h-[calc(100dvh-4rem)] px-4 py-6 sm:py-16 md:py-24">
      <div className="relative mx-auto max-w-7xl">
        <div className="mb-4 text-center sm:mb-10 md:mb-14">
          <div className="mb-2 hidden items-center justify-center gap-2 sm:inline-flex">
            <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                {badge}
              </span>
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-4xl">
            {heading}
          </h1>
          <p className="mx-auto mt-1.5 hidden max-w-md text-sm leading-relaxed text-white/45 sm:mt-3 sm:block">
            {subheading}
          </p>
        </div>

        <Suspense>
          <ConversionWizard />
        </Suspense>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-[10px] uppercase tracking-[0.18em] text-white/25">
          {resolvedTrustItems.map((item, index) => (
            <div key={`${item}-${index}`} className="flex items-center gap-6">
              {index > 0 && <span className="hidden sm:inline">•</span>}
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
