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
      <section className="relative py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase text-gold">
              Try It
            </p>
            <h2 className="font-display text-3xl font-bold text-white-95 sm:text-4xl">
              Convert instantly
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-white-40">
              Swap between KES, USD, BTC, and stablecoins — preview rates before you sign up.
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
