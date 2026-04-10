/**
 * Section Renderer — maps CMS section_type values to React components.
 *
 * Architecture: Each existing marketing component remains unchanged (zero-prop,
 * hardcoded). The renderer wraps them with CMS-sourced content via lightweight
 * CMS wrapper components. If a section has no CMS wrapper, it renders the
 * original component as-is.
 *
 * This means the premium UI is NEVER degraded — CMS just overrides text content.
 */

import type { PageSection } from '@/lib/cms/types';
import { MarketRibbon, type RibbonRate } from '@/components/marketing/market-ribbon';
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
 * Components that don't accept CMS props map directly to existing components.
 * Components that CAN be driven by CMS content use lightweight wrappers.
 */
function buildRegistry(initialRates?: RibbonRate[]): Record<
  string,
  React.ComponentType<{ section: PageSection }>
> {
  return {
    // These render the original components as-is (CMS only controls ordering)
    market_ribbon: () => <MarketRibbon initialRates={initialRates} />,
    hero: () => <HeroSection />,
    stats: () => <TrustStrip />,
    feature_grid: () => <ProductPillars />,
    how_it_works: () => <HowItWorks />,
    security: () => <SecuritySection />,
    cards: () => <CardsSection />,
    global_finance: () => <GlobalFinanceSection />,
    final_cta: () => <FinalCTA />,

    // These have CMS-driven wrappers for editable content
    swap_widget: CmsSwapSection,
    rich_text: CmsRichText,
    cta: CmsCta,
  };
}

export function SectionRenderer({
  sections,
  initialRates,
}: {
  sections: PageSection[];
  initialRates?: RibbonRate[];
}) {
  const registry = buildRegistry(initialRates);
  return (
    <>
      {sections.map((section) => {
        const Component = registry[section.section_type];
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
