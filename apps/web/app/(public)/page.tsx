import { getPageBySlug, getSeoDefaults, getBranding } from '@/lib/cms';
import type { Metadata } from 'next';
import type { PageSection } from '@/lib/cms';
import { SectionRenderer } from '@/lib/cms/section-renderer';
import { fetchRibbonRates } from '@/lib/api/rates';

export async function generateMetadata(): Promise<Metadata> {
  const [page, seo, branding] = await Promise.all([
    getPageBySlug('/'),
    getSeoDefaults(),
    getBranding(),
  ]);

  if (!page) return {};

  const title = page.meta_title || seo?.fallback_title || 'Koya — Borderless Finance';
  const description = page.meta_description || seo?.fallback_description || '';
  const ogImage =
    page.og_image || branding?.og_default_image || seo?.fallback_og_image || null;

  return {
    title: { absolute: title },
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

export default async function LandingPage() {
  const [page, initialRates] = await Promise.all([
    getPageBySlug('/'),
    fetchRibbonRates(),
  ]);
  const sections = page?.sections as PageSection[] | undefined;

  return (
    <main className="overflow-x-hidden">
      {sections?.length ? (
        <SectionRenderer sections={sections} initialRates={initialRates} />
      ) : (
        <section className="px-6 py-24 text-center">
          <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-8">
            <h1 className="font-display text-2xl font-bold text-white-95 sm:text-3xl">
              Content unavailable
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-white-40">
              The homepage is temporarily unavailable while content sync is in progress.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
