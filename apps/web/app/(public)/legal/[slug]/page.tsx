import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLegalPage, getSeoDefaults, getBranding } from '@/lib/cms';
import { SectionShell } from '@/components/marketing/section-shell';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [page, seo, branding] = await Promise.all([
    getLegalPage(slug),
    getSeoDefaults(),
    getBranding(),
  ]);

  if (!page) return {};

  const title = page.meta_title || page.title;
  const description = page.meta_description || seo?.fallback_description || '';
  const ogImage = branding?.og_default_image || seo?.fallback_og_image || null;

  return {
    title: seo?.title_suffix ? `${title}${seo.title_suffix}` : title,
    description,
    openGraph: {
      title,
      description,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
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
