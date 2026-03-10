'use client';

import { SectionShell } from '@/components/marketing/section-shell';
import { FadeUp } from '@/components/marketing/motion-wrapper';
import { StaggerContainer, StaggerItem } from '@/components/marketing/motion-wrapper';

const tickers = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: '237.42', change: '+1.24%', positive: true },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: '278.91', change: '-0.87%', positive: false },
  { symbol: 'SPY', name: 'S&P 500 ETF', price: '584.16', change: '+0.52%', positive: true },
  { symbol: 'MSFT', name: 'Microsoft', price: '428.53', change: '+0.91%', positive: true },
];

export function GlobalFinanceSection() {
  return (
    <SectionShell id="investing" bg="surface">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Info */}
        <FadeUp>
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase text-gold">
            Global Investing
          </p>
          <h2 className="font-display text-3xl font-bold text-white-95 sm:text-4xl">
            Your money moves globally.
            <br />
            <span className="text-gradient-gold">Your investments should too.</span>
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white-40">
            Access U.S. stock markets directly from your Koya account.
            Buy fractional shares of the world&apos;s biggest companies — fund from
            any currency, settle in USD.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full border border-white-10 bg-white-5 px-3 py-1 text-xs font-medium text-white-60">
              Fractional shares
            </span>
            <span className="rounded-full border border-white-10 bg-white-5 px-3 py-1 text-xs font-medium text-white-60">
              U.S. equities & ETFs
            </span>
            <span className="rounded-full border border-white-10 bg-white-5 px-3 py-1 text-xs font-medium text-white-60">
              Fund from any wallet
            </span>
          </div>
        </FadeUp>

        {/* Mock stock tickers */}
        <FadeUp delay={0.12}>
          <StaggerContainer stagger={0.08} className="flex flex-col gap-3">
            {tickers.map((t) => (
              <StaggerItem key={t.symbol}>
                <div className="flex items-center justify-between rounded-xl border border-white-5 bg-white-5/30 px-5 py-4 backdrop-blur-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white-5">
                      <span className="font-mono text-xs font-bold text-gold">
                        {t.symbol.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold text-white-95">
                        {t.symbol}
                      </p>
                      <p className="text-xs text-white-40">{t.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-medium text-white-80">
                      ${t.price}
                    </p>
                    <p
                      className={`font-mono text-xs font-semibold ${
                        t.positive ? 'text-emerald' : 'text-red'
                      }`}
                    >
                      {t.change}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </FadeUp>
      </div>
    </SectionShell>
  );
}
