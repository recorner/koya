import type { PageSection } from '@/lib/cms/types';
import { SectionShell } from '@/components/marketing/section-shell';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

export function CmsRichText({
  section: _section,
  content,
}: {
  section: PageSection;
  content: MarketingSectionContent;
}) {
  void _section;

  const bg = (content.config?.bg as 'default' | 'surface' | 'cell' | 'navy') ?? 'default';

  return (
    <SectionShell bg={bg}>
      {content.badge && (
        <p className="mb-3 text-center text-[11px] uppercase tracking-[0.2em] text-gold">{content.badge}</p>
      )}
      {content.heading && (
        <h2 className="mb-4 text-center font-display text-3xl tracking-tight text-white-95 sm:text-4xl">{content.heading}</h2>
      )}
      {content.subheading && (
        <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-7 text-white/60 sm:text-base">{content.subheading}</p>
      )}
      {content.body && (
        <div
          className="prose prose-invert prose-sm mx-auto max-w-3xl"
          dangerouslySetInnerHTML={{ __html: content.body }}
        />
      )}
    </SectionShell>
  );
}
