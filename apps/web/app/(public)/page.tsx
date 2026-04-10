import { getPageBySlug } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { SectionRenderer } from '@/lib/cms/section-renderer';
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
import { fetchRibbonRates } from '@/lib/api/rates';

/** Revalidate homepage every 60 seconds for near-instant CMS updates. */
export const revalidate = 60;

export default async function LandingPage() {
  const [page, initialRates] = await Promise.all([
    getPageBySlug('/'),
    fetchRibbonRates(),
  ]);
  const sections = page?.sections as PageSection[] | undefined;

  // CMS-driven: render sections in the order defined in content
  if (sections?.length) {
    return (
      <main className="overflow-x-hidden">
        <SectionRenderer sections={sections} initialRates={initialRates} />
      </main>
    );
  }

  // Fallback: hardcoded layout when CMS is unavailable or page not configured
  return (
    <main className="overflow-x-hidden">
      <MarketRibbon initialRates={initialRates} />
      <HeroSection />
      <section className="relative py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8 text-center">
            <p className="mb-2 text-xs font-semibold tracking-[0.2em] uppercase text-gold">
              Try It
            </p>
            <h2 className="font-display text-2xl font-bold text-white-95 sm:text-3xl">
              Preview your conversion
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-white-40">
              See live indicative rates between KES, USD, BTC, and stablecoins — no account needed.
            </p>
          </div>
          <GuestSwapWidget />
        </div>
      </section>
      <TrustStrip />
      <ProductPillars />
      <HowItWorks />
      <SecuritySection />
      <CardsSection />
      <GlobalFinanceSection />
      <FinalCTA />
    </main>
  );
}
