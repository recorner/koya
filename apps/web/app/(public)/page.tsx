import dynamic from 'next/dynamic';
import { MarketRibbon } from '@/components/marketing/market-ribbon';
import { HeroSection } from '@/components/marketing/hero-section';

/* Lightweight placeholder that matches section height to prevent layout shift */
function SectionSkeleton({ className = 'h-[400px]' }: { className?: string }) {
  return <div className={`${className} w-full`} />;
}

const GuestSwapWidget = dynamic(
  () => import('@/components/marketing/guest-swap-widget').then(m => ({ default: m.GuestSwapWidget })),
  { loading: () => <SectionSkeleton className="mx-auto h-[420px] max-w-[460px]" /> },
);
const TrustStrip = dynamic(
  () => import('@/components/marketing/trust-strip').then(m => ({ default: m.TrustStrip })),
  { loading: () => <SectionSkeleton className="h-16" /> },
);
const ProductPillars = dynamic(
  () => import('@/components/marketing/product-pillars').then(m => ({ default: m.ProductPillars })),
  { loading: () => <SectionSkeleton className="h-[600px]" /> },
);
const HowItWorks = dynamic(
  () => import('@/components/marketing/how-it-works').then(m => ({ default: m.HowItWorks })),
  { loading: () => <SectionSkeleton className="h-[700px]" /> },
);
const SecuritySection = dynamic(
  () => import('@/components/marketing/security-section').then(m => ({ default: m.SecuritySection })),
  { loading: () => <SectionSkeleton className="h-[600px]" /> },
);
const CardsSection = dynamic(
  () => import('@/components/marketing/cards-section').then(m => ({ default: m.CardsSection })),
  { loading: () => <SectionSkeleton className="h-[500px]" /> },
);
const GlobalFinanceSection = dynamic(
  () => import('@/components/marketing/global-finance-section').then(m => ({ default: m.GlobalFinanceSection })),
  { loading: () => <SectionSkeleton className="h-[500px]" /> },
);
const FinalCTA = dynamic(
  () => import('@/components/marketing/final-cta').then(m => ({ default: m.FinalCTA })),
  { loading: () => <SectionSkeleton className="h-[400px]" /> },
);

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
