import type { PageSection } from '@/lib/directus/types';
import { GuestSwapWidget } from '@/components/marketing/guest-swap-widget';

/**
 * CMS wrapper for the swap widget section.
 * Renders the heading/subheading from CMS, widget from code.
 */
export function CmsSwapSection({ section }: { section: PageSection }) {
  return (
    <section className="relative py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6">
        {(section.badge_text || section.heading) && (
          <div className="mb-8 text-center">
            {section.badge_text && (
              <p className="mb-2 text-xs font-semibold tracking-[0.2em] uppercase text-gold">
                {section.badge_text}
              </p>
            )}
            {section.heading && (
              <h2 className="font-display text-2xl font-bold text-white-95 sm:text-3xl">
                {section.heading}
              </h2>
            )}
            {section.subheading && (
              <p className="mx-auto mt-3 max-w-md text-sm text-white-40">
                {section.subheading}
              </p>
            )}
          </div>
        )}
        <GuestSwapWidget />
      </div>
    </section>
  );
}
