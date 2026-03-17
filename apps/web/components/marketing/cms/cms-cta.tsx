import type { PageSection } from '@/lib/directus/types';
import { SectionShell } from '@/components/marketing/section-shell';
import { Button } from '@/components/ui/button';
import { ArrowUpRight } from 'lucide-react';

/**
 * CMS-driven CTA section — a simple call-to-action block with heading + button.
 */
export function CmsCta({ section }: { section: PageSection }) {
  return (
    <SectionShell bg="surface">
      <div className="text-center">
        {section.badge_text && (
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase text-gold">
            {section.badge_text}
          </p>
        )}
        {section.heading && (
          <h2 className="mx-auto max-w-3xl font-display text-3xl font-bold text-white-95 sm:text-4xl md:text-5xl">
            {section.heading}
          </h2>
        )}
        {section.subheading && (
          <p className="mx-auto mt-5 max-w-xl text-sm text-white-40 sm:text-base">
            {section.subheading}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {section.cta_label && (
            <Button size="lg" asChild>
              <a href={section.cta_href ?? '#'}>
                {section.cta_label}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
          {section.cta_secondary_label && (
            <Button size="lg" variant="outline" asChild>
              <a href={section.cta_secondary_href ?? '#'}>
                {section.cta_secondary_label}
              </a>
            </Button>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
