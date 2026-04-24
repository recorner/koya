import type { PageSection } from '@/lib/cms/types';
import { SectionShell } from '@/components/marketing/section-shell';
import { Button } from '@/components/ui/button';
import { ArrowUpRight } from 'lucide-react';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

export function CmsCta({
  section: _section,
  content,
}: {
  section: PageSection;
  content: MarketingSectionContent;
}) {
  void _section;

  return (
    <SectionShell bg="surface">
      <div className="text-center">
        {content.badge && (
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{content.badge}</p>
        )}
        {content.heading && (
          <h2 className="mx-auto mt-3 max-w-3xl font-display text-3xl tracking-tight text-white-95 sm:text-4xl md:text-5xl">
            {content.heading}
          </h2>
        )}
        {content.subheading && (
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">{content.subheading}</p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {content.cta && (
            <Button size="lg" asChild>
              <a href={content.cta.href}>
                {content.cta.label}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
          {content.secondaryCta && (
            <Button size="lg" variant="outline" asChild>
              <a href={content.secondaryCta.href}>{content.secondaryCta.label}</a>
            </Button>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
