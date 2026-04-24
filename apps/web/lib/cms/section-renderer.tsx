import type { PageSection } from '@/lib/cms/types';
import { MarketRibbon, type RibbonRate } from '@/components/marketing/market-ribbon';
import { HeroSection } from '@/components/marketing/hero-section';
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
import {
  normalizeSectionContent,
  type MarketingSectionContent,
} from '@/components/marketing/section-content';

type SectionComponent = React.ComponentType<{
  section: PageSection;
  content: MarketingSectionContent;
}>;

function buildRegistry(initialRates?: RibbonRate[]): Record<string, SectionComponent> {
  return {
    market_ribbon: ({ content }) => <MarketRibbon initialRates={initialRates} content={content} />,
    hero: ({ content }) => <HeroSection content={content} />,
    stats: ({ content }) => <TrustStrip content={content} />,
    feature_grid: ({ content }) => <ProductPillars content={content} />,
    how_it_works: ({ content }) => <HowItWorks content={content} />,
    security: ({ content }) => <SecuritySection content={content} />,
    cards: ({ content }) => <CardsSection content={content} />,
    global_finance: ({ content }) => <GlobalFinanceSection content={content} />,
    final_cta: ({ content }) => <FinalCTA content={content} />,
    swap_widget: CmsSwapSection,
    rich_text: CmsRichText,
    cta: CmsCta,
    trust_footer_items: () => null,
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
            console.warn(`[CMS] Unknown section_type: "${section.section_type}" (id=${section.id})`);
          }
          return null;
        }

        return (
          <Component
            key={section.id}
            section={section}
            content={normalizeSectionContent(section)}
          />
        );
      })}
    </>
  );
}
