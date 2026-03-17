/**
 * Section Renderer — maps CMS section_type values to React components.
 *
 * Architecture: Each marketing component accepts optional CMS props (heading,
 * subheading, badge_text, items, etc.) with hardcoded fallbacks. The renderer
 * passes CMS data to each component, preserving the premium UI at all times.
 * Icons, animations, and styling always come from code.
 */

import type { PageSection } from '@/lib/directus/types';
import { MarketRibbon } from '@/components/marketing/market-ribbon';
import { HeroSection } from '@/components/marketing/hero-section';
import { GuestSwapWidget } from '@/components/marketing/guest-swap-widget';
import { TrustStrip } from '@/components/marketing/trust-strip';
import { ProductPillars } from '@/components/marketing/product-pillars';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { SecuritySection } from '@/components/marketing/security-section';
import { CardsSection } from '@/components/marketing/cards-section';
import { GlobalFinanceSection } from '@/components/marketing/global-finance-section';
import { FinalCTA } from '@/components/marketing/final-cta';
import { CmsSwapSection } from '@/components/marketing/cms/cms-swap-section';
import { CmsRichText } from '@/components/marketing/cms/cms-rich-text';
import { CmsCta } from '@/components/marketing/cms/cms-cta';

/**
 * Registry mapping section_type → React component.
 *
 * All components receive CMS text overrides via props with hardcoded fallbacks.
 * Icons, styling, and animations always come from code.
 */
const sectionRegistry: Record<
  string,
  React.ComponentType<{ section: PageSection }>
> = {
  market_ribbon: () => <MarketRibbon />,
  hero: ({ section }) => (
    <HeroSection
      heading={section.heading}
      subheading={section.subheading}
      badgeText={section.badge_text}
      ctaLabel={section.cta_label}
      ctaHref={section.cta_href}
      ctaSecondaryLabel={section.cta_secondary_label}
      ctaSecondaryHref={section.cta_secondary_href}
    />
  ),
  stats: ({ section }) => (
    <TrustStrip
      heading={section.heading}
      subheading={section.subheading}
      items={section.items}
    />
  ),
  feature_grid: ({ section }) => (
    <ProductPillars
      badgeText={section.badge_text}
      heading={section.heading}
      subheading={section.subheading}
      items={section.items}
    />
  ),
  how_it_works: ({ section }) => (
    <HowItWorks
      badgeText={section.badge_text}
      heading={section.heading}
      subheading={section.subheading}
      items={section.items}
    />
  ),
  security: ({ section }) => (
    <SecuritySection
      badgeText={section.badge_text}
      heading={section.heading}
      subheading={section.subheading}
      items={section.items}
    />
  ),
  cards: ({ section }) => (
    <CardsSection
      badgeText={section.badge_text}
      heading={section.heading}
      subheading={section.subheading}
      items={section.items}
    />
  ),
  global_finance: ({ section }) => (
    <GlobalFinanceSection
      badgeText={section.badge_text}
      heading={section.heading}
      subheading={section.subheading}
      items={section.items}
    />
  ),
  final_cta: ({ section }) => (
    <FinalCTA
      badgeText={section.badge_text}
      heading={section.heading}
      subheading={section.subheading}
      ctaLabel={section.cta_label}
    />
  ),

  // These have CMS-driven wrappers for editable content
  swap_widget: CmsSwapSection,
  rich_text: CmsRichText,
  cta: CmsCta,
};

export function SectionRenderer({ sections }: { sections: PageSection[] }) {
  return (
    <>
      {sections.map((section) => {
        const Component = sectionRegistry[section.section_type];
        if (!Component) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              `[CMS] Unknown section_type: "${section.section_type}" (id=${section.id})`
            );
          }
          return null;
        }
        return <Component key={section.id} section={section} />;
      })}
    </>
  );
}
