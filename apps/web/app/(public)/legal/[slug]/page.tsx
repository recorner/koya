import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLegalPage, getSeoDefaults } from '@/lib/cms';
import { SectionShell } from '@/components/marketing/section-shell';

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [page, seo] = await Promise.all([
    getLegalPage(slug),
    getSeoDefaults(),
  ]);

  if (!page) return {};

  const title = page.meta_title || page.title;
  const description = page.meta_description || seo?.fallback_description || '';

  return {
    title: seo?.title_suffix ? `${title}${seo.title_suffix}` : title,
    description,
  };
}

export default async function LegalPageRoute({ params }: Props) {
  const { slug } = await params;
  const page = await getLegalPage(slug);

  if (!page) notFound();

  return (
    <main className="overflow-x-hidden">
      <SectionShell>
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-8 font-display text-3xl font-bold text-white-95 sm:text-4xl">
            {page.title}
          </h1>
          {page.updated_at && (
            <p className="mb-8 text-sm text-white-40">
              Last updated:{' '}
              {new Date(page.updated_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}
          <div
            className="prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </div>
      </SectionShell>
    </main>
  );
}
