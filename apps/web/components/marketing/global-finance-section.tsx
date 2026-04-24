'use client';

import { BarChart3, CircleDollarSign, Globe2, Landmark, Wallet } from 'lucide-react';
import { SectionShell } from '@/components/marketing/section-shell';
import { FadeUp } from '@/components/marketing/motion-wrapper';
import { STOCK_TICKERS } from '@/components/marketing/asset-metadata';
import { StockIcon } from '@/components/marketing/asset-icons';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

const highlights = [
  {
    icon: Wallet,
    title: 'Fund from active balances',
    description: 'Deploy capital from wallets already inside your account system.',
  },
  {
    icon: CircleDollarSign,
    title: 'Fractional access',
    description: 'Enter global positions with smaller ticket sizes and clear exposure controls.',
  },
  {
    icon: Globe2,
    title: 'Cross-border participation',
    description: 'Move from local rails into international market assets without account switching.',
  },
];

export function GlobalFinanceSection({ content }: { content?: MarketingSectionContent }) {
  return (
    <SectionShell id="investing" bg="cell">
      <div className="grid items-start gap-10 lg:grid-cols-12">
        <FadeUp className="lg:col-span-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{content?.badge || 'Global Finance'}</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-white-95 sm:text-4xl md:text-5xl">
            {content?.heading || 'Access global markets from your core Koya account.'}
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
            {content?.subheading ||
              'Use the same wallet and conversion foundation to deploy into major equities and ETFs with clear funding paths.'}
          </p>

          <div className="mt-7 space-y-2.5">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border border-white/10 bg-[#121212] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-gold/35 bg-gold/10 text-gold">
                      <Icon size={16} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white/88">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-white/56">{item.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </FadeUp>

        <FadeUp delay={0.1} className="lg:col-span-7">
          <div className="rounded-xl border border-white/12 bg-[#141414] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/42">Portfolio view</p>
                <p className="mt-2 font-mono text-3xl tabular-nums text-white-95">$18,420.60</p>
                <p className="mt-1 font-mono text-xs text-emerald">+6.24% 30D</p>
              </div>
              <div className="rounded-md border border-white/10 bg-[#101010] px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">Settlement</p>
                <p className="mt-1 text-sm text-white/78">USD Wallet</p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-[#111111] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Allocation sketch</p>
                <BarChart3 className="h-4 w-4 text-gold" />
              </div>
              <div className="space-y-3">
                {[
                  { label: 'U.S. Equities', width: '70%' },
                  { label: 'Broad ETFs', width: '54%' },
                  { label: 'USD Cash', width: '36%' },
                ].map((row) => (
                  <div key={row.label}>
                    <p className="mb-1 text-xs text-white/58">{row.label}</p>
                    <div className="h-1.5 bg-white/8">
                      <div className="h-full bg-[linear-gradient(90deg,#9e7531_0%,#c8963c_55%,#ddb56f_100%)]" style={{ width: row.width }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-[#111111] p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-gold" />
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Funding path</p>
                </div>
                <p className="text-xs leading-6 text-white/58">KES wallet → USD conversion → market deployment.</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#111111] p-3.5">
                <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">Market list</p>
                <div className="space-y-2">
                  {STOCK_TICKERS.slice(0, 3).map((stock) => (
                    <div key={stock.symbol} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <StockIcon symbol={stock.symbol} size={18} />
                        <span className="font-mono text-white/76">{stock.symbol}</span>
                      </div>
                      <span className={stock.positive ? 'font-mono text-emerald' : 'font-mono text-red'}>{stock.change}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
    </SectionShell>
  );
}
