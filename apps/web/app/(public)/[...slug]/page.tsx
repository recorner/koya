import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPageBySlug, getSeoDefaults } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { SectionRenderer } from '@/lib/cms/section-renderer';

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const slugPath = `/${slug.join('/')}`;
  const [page, seo] = await Promise.all([
    getPageBySlug(slugPath),
    getSeoDefaults(),
  ]);

  if (!page) return {};

  const title = page.meta_title || page.title;
  const description = page.meta_description || seo?.fallback_description || '';

  return {
    title: seo?.title_suffix ? `${title}${seo.title_suffix}` : title,
    description,
    openGraph: { title, description },
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
