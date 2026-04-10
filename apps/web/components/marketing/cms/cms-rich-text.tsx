import type { PageSection } from '@/lib/cms/types';
import { SectionShell } from '@/components/marketing/section-shell';

/**
 * CMS-driven rich text section for arbitrary markdown/HTML content.
 */
export function CmsRichText({ section }: { section: PageSection }) {
  const bg = (section.config?.bg as 'default' | 'surface' | 'cell' | 'navy') ?? 'default';

  return (
    <SectionShell bg={bg}>
      {section.badge_text && (
        <p className="mb-2 text-center text-xs font-semibold tracking-[0.2em] uppercase text-gold">
          {section.badge_text}
        </p>
      )}
      {section.heading && (
        <h2 className="mb-4 text-center font-display text-2xl font-bold text-white-95 sm:text-3xl md:text-4xl">
          {section.heading}
        </h2>
      )}
      {section.subheading && (
        <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-white-40 sm:text-base">
          {section.subheading}
        </p>
      )}
      {section.body && (
        <div
          className="prose prose-invert prose-sm mx-auto max-w-3xl"
          dangerouslySetInnerHTML={{ __html: section.body }}
        />
      )}
    </SectionShell>
  );
}
