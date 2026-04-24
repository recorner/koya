import type { PageSection } from '@/lib/cms/types';
import { GuestSwapWidget } from '@/components/marketing/guest-swap-widget';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

export function CmsSwapSection({
  section: _section,
  content,
}: {
  section: PageSection;
  content: MarketingSectionContent;
}) {
  void _section;

  return (
    <section className="bg-vault-black py-14 md:py-18">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {(content.badge || content.heading) && (
          <div className="mb-8 text-center">
            {content.badge && (
              <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{content.badge}</p>
            )}
            {content.heading && (
              <h2 className="mt-3 font-display text-3xl tracking-tight text-white-95 sm:text-4xl">{content.heading}</h2>
            )}
            {content.subheading && (
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/60">{content.subheading}</p>
            )}
          </div>
        )}
        <GuestSwapWidget />
      </div>
    </section>
  );
}
