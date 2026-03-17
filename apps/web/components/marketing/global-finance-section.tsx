'use client';

import { SectionShell } from '@/components/marketing/section-shell';
import {
  FadeUp,
} from '@/components/marketing/motion-wrapper';
import { StockIcon } from '@/components/marketing/asset-icons';
import { STOCK_TICKERS } from '@/components/marketing/asset-metadata';
import {
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  Globe2,
  Landmark,
  Sparkles,
  Wallet,
} from 'lucide-react';

interface GlobalFinanceSectionProps {
  badgeText?: string | null;
  heading?: string | null;
  subheading?: string | null;
  items?: Record<string, unknown>[] | null;
}

const defaultCapabilities = [
  {
    icon: Wallet,
    title: 'Fund from existing wallets',
    description:
      'Use available balances instead of wiring money into disconnected platforms.',
  },
  {
    icon: CircleDollarSign,
    title: 'Fractional investing access',
    description:
      'Enter positions with smaller ticket sizes while keeping exposure to major names and ETFs.',
  },
  {
    icon: Globe2,
    title: 'Global market participation',
    description:
      'Expand beyond local cash storage into international public markets.',
  },
];

export function GlobalFinanceSection({ badgeText, heading, subheading, items }: GlobalFinanceSectionProps = {}) {
  const displayCapabilities = defaultCapabilities.map((c, i) => {
    const cms = items?.[i];
    if (!cms) return c;
    return {
      ...c,
      title: (cms.title as string) || c.title,
      description: (cms.description as string) || c.description,
    };
  });

  return (
    <SectionShell id="investing" bg="surface">
      <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
        {/* LEFT: narrative */}
        <FadeUp className="lg:col-span-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(212,175,55,0.95)]">
            {badgeText || 'Global investing'}
          </p>

          {heading ? (
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              {heading}
            </h2>
          ) : (
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
              Invest in U.S. stocks
              <span className="block bg-[linear-gradient(180deg,#F0D060_0%,#D4AF37_48%,#A88520_100%)] bg-clip-text text-transparent">
                from your Koya account
              </span>
            </h2>
          )}

          <p className="mt-5 max-w-xl text-sm leading-7 text-white/56 sm:text-base">
            {subheading || 'Buy fractional shares of Apple, Tesla, S&P 500 ETFs, and more \u2014 funded directly from your Koya wallets. No separate brokerage account needed.'}
          </p>

          <div className="mt-8 space-y-3">
            {displayCapabilities.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[rgba(212,175,55,0.14)] bg-[rgba(212,175,55,0.10)] text-[rgba(212,175,55,0.95)]">
                      <Icon size={18} strokeWidth={1.7} />
                    </div>

                    <div>
                      <h3 className="text-base font-semibold tracking-tight text-white">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-white/56">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {[
              'Fractional shares',
              'U.S. equities',
              'ETFs',
              'USD settlement',
            ].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/58"
              >
                {tag}
              </span>
            ))}
          </div>
        </FadeUp>

        {/* RIGHT: investing surface */}
        <FadeUp delay={0.12} className="lg:col-span-7">
          <div className="relative mx-auto w-full max-w-[700px]">
            {/* ambient glow */}
            <div className="pointer-events-none absolute left-1/2 top-[38%] h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-[rgba(212,175,55,0.08)] blur-3xl" />
            <div className="pointer-events-none absolute right-[4%] top-[8%] h-[180px] w-[180px] rounded-full bg-[rgba(0,229,255,0.05)] blur-2xl" />

            <div className="grid gap-4 md:grid-cols-12">
              {/* main portfolio card */}
              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-md md:col-span-8">
                <div className="pointer-events-none absolute -right-14 -top-14 h-32 w-32 rounded-full bg-[rgba(212,175,55,0.10)] blur-3xl" />

                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                        Investment portfolio
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
                        $18,420.60
                      </div>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        +6.24% this month
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-right">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-white/36">
                        Settlement
                      </div>
                      <div className="mt-1 text-sm font-medium text-white/80">
                        USD wallet
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Buying power', value: '$2,840' },
                      { label: 'Open positions', value: '12' },
                      { label: 'Fractional enabled', value: 'Yes' },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
                      >
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/36">
                          {item.label}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white/84">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-[24px] border border-white/8 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                        Top allocations
                      </div>
                      <BarChart3 className="h-4 w-4 text-[rgba(212,175,55,0.85)]" />
                    </div>

                    <div className="space-y-3">
                      {[
                        { label: 'U.S. Equities', width: 'w-[68%]' },
                        { label: 'Broad Market ETFs', width: 'w-[52%]' },
                        { label: 'Cash in USD', width: 'w-[34%]' },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="mb-1 flex items-center justify-between text-xs text-white/56">
                            <span>{item.label}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/6">
                            <div
                              className={`h-full rounded-full bg-[linear-gradient(90deg,#A88520_0%,#D4AF37_55%,#F0D060_100%)] ${item.width}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* side chips */}
              <div className="space-y-4 md:col-span-4">
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.03)_100%)] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.24)] backdrop-blur-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-[rgba(212,175,55,0.95)]" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                      Funding path
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-white/74">
                    <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
                      <span>KES Wallet</span>
                      <ArrowUpRight className="h-4 w-4 text-white/24" />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
                      <span>Convert to USD</span>
                      <ArrowUpRight className="h-4 w-4 text-white/24" />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
                      <span>Deploy to markets</span>
                      <ArrowUpRight className="h-4 w-4 text-white/24" />
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.03)_100%)] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.24)] backdrop-blur-sm">
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                    Market access
                  </div>

                  <div className="space-y-3">
                    {STOCK_TICKERS.slice(0, 4).map((t) => (
                      <div
                        key={t.symbol}
                        className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <StockIcon symbol={t.symbol} size={28} />
                          <div>
                            <p className="font-mono text-sm font-semibold text-white">
                              {t.symbol}
                            </p>
                            <p className="text-[11px] text-white/40">{t.name}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-mono text-sm font-medium text-white/80">
                            ${t.price}
                          </p>
                          <p
                            className={`font-mono text-[11px] font-semibold ${
                              t.positive ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            {t.change}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
    </SectionShell>
  );
}