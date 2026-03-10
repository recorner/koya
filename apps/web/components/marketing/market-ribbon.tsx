'use client';

import { cn } from '@/lib/utils';

interface MarketInstrument {
  pair: string;
  price: string;
  change: string;
  positive: boolean;
}

const instruments: MarketInstrument[] = [
  { pair: 'KES / USD', price: '0.00770', change: '+0.12%', positive: true },
  { pair: 'USD / KES', price: '129.85', change: '-0.12%', positive: false },
  { pair: 'USDC / USD', price: '1.0001', change: '+0.01%', positive: true },
  { pair: 'BTC / USD', price: '87,432.10', change: '+2.34%', positive: true },
  { pair: 'BTC / KES', price: '11,352,978', change: '+2.21%', positive: true },
];

export function MarketRibbon() {
  return (
    <div className="relative z-40 border-b border-white-5 bg-cell/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6">
        <div className="scrollbar-none flex items-center gap-6 overflow-x-auto py-2.5 md:justify-center md:gap-8">
          {instruments.map((item) => (
            <div
              key={item.pair}
              className="flex shrink-0 items-center gap-3"
            >
              <span className="text-xs font-medium text-white-40">
                {item.pair}
              </span>
              <span className="font-mono text-xs font-medium text-white-80">
                {item.price}
              </span>
              <span
                className={cn(
                  'font-mono text-[10px] font-semibold',
                  item.positive ? 'text-emerald' : 'text-red',
                )}
              >
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
