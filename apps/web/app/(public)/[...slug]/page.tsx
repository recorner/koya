import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPageBySlug, getSeoDefaults, getBranding } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { SectionRenderer } from '@/lib/cms/section-renderer';

interface Props {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const slugPath = `/${slug.join('/')}`;
  const [page, seo, branding] = await Promise.all([
    getPageBySlug(slugPath),
    getSeoDefaults(),
    getBranding(),
  ]);

  if (!page) return {};

  const title = page.meta_title || page.title;
  const description = page.meta_description || seo?.fallback_description || '';
  const ogImage = page.og_image || branding?.og_default_image || seo?.fallback_og_image || null;

  return {
    title: seo?.title_suffix ? `${title}${seo.title_suffix}` : title,
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

export default async function DynamicPage({ params }: Props) {
  const { slug } = await params;
  const slugPath = `/${slug.join('/')}`;
  const page = await getPageBySlug(slugPath);

  if (!page) notFound();

  const sections = page.sections as PageSection[];

  return (
    <main className="overflow-x-hidden">
      <SectionRenderer sections={sections} />
    </main>
  );
}
