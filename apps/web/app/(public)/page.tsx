import dynamic from 'next/dynamic';
import { MarketRibbon } from '@/components/marketing/market-ribbon';
import { HeroSection } from '@/components/marketing/hero-section';

const GuestSwapWidget = dynamic(() => import('@/components/marketing/guest-swap-widget').then(m => ({ default: m.GuestSwapWidget })));
const TrustStrip = dynamic(() => import('@/components/marketing/trust-strip').then(m => ({ default: m.TrustStrip })));
const ProductPillars = dynamic(() => import('@/components/marketing/product-pillars').then(m => ({ default: m.ProductPillars })));
const HowItWorks = dynamic(() => import('@/components/marketing/how-it-works').then(m => ({ default: m.HowItWorks })));
const SecuritySection = dynamic(() => import('@/components/marketing/security-section').then(m => ({ default: m.SecuritySection })));
const CardsSection = dynamic(() => import('@/components/marketing/cards-section').then(m => ({ default: m.CardsSection })));
const GlobalFinanceSection = dynamic(() => import('@/components/marketing/global-finance-section').then(m => ({ default: m.GlobalFinanceSection })));
const FinalCTA = dynamic(() => import('@/components/marketing/final-cta').then(m => ({ default: m.FinalCTA })));

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
