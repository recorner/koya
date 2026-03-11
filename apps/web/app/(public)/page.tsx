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

export default function LandingPage() {
  return (
    <main className="overflow-x-hidden">
      <MarketRibbon />
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
