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
      preview?.og_description ?? 'View real-time status of your KES → BTC conversion on Koya.';
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
  const ogImage = page?.og_image || branding?.og_default_image || seo?.fallback_og_image || null;

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
  const trustFooterSection = sections.find((section) => section.section_type === 'trust_footer_items');

  const heading = heroSection?.heading || 'Convert KES to BTC with controlled execution';
  const subheading =
    heroSection?.subheading ||
    'No account required. Enter your amount, verify identity, and settle through M-Pesa in a secure guided flow.';
  const badge = heroSection?.badge_text || 'Guest conversion';

  const trustItems = extractTrustFooterItems(trustFooterSection);
  const fallbackTrustItems = ['Encrypted flow', 'KYC verified', 'Guest limit: KES 100K/day'];
  const resolvedTrustItems = trustItems.length ? trustItems : fallbackTrustItems;

  return (
    <section className="relative min-h-[calc(100dvh-4rem)] border-t border-white/8 bg-vault-black px-4 py-8 sm:py-14 md:py-18">
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:120px_120px]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-8 text-center sm:mb-10 md:mb-12">
          <div className="mb-3 inline-flex items-center justify-center rounded-md border border-white/12 bg-[#111111] px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-gold">{badge}</span>
          </div>
          <h1 className="font-display text-3xl tracking-tight text-white-95 sm:text-4xl md:text-5xl">{heading}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">{subheading}</p>
        </div>

        <Suspense>
          <ConversionWizard />
        </Suspense>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3 text-[10px] uppercase tracking-[0.16em] text-white/36">
          {resolvedTrustItems.map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-md border border-white/10 bg-[#111111] px-3 py-1.5">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
