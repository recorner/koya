'use client';

import { useState, useMemo, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssetIcon } from '@/components/marketing/asset-icons';
import { conversionApi, type QuoteResponse } from '@/lib/api/conversion';

export function AmountStep({
  onQuoteReady,
}: {
  onQuoteReady: (quote: QuoteResponse) => void;
}) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const numericAmount = useMemo(() => {
    const val = parseFloat(amount.replace(/,/g, ''));
    return !val || val <= 0 ? 0 : val;
  }, [amount]);

  const isValid = numericAmount >= 100 && numericAmount <= 100_000;

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');

    try {
      const quote = await conversionApi.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: numericAmount.toString(),
        channel: 'WEB',
      });
      onQuoteReady(quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
    } finally {
      setLoading(false);
    }
  }, [isValid, numericAmount, onQuoteReady]);

  return (
    <div>
      <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
        Convert KES to BTC
      </h2>
      <p className="mt-1.5 text-sm text-white/50">
        Enter the amount in Kenyan Shillings you want to convert.
      </p>

      <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
          You pay
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <AssetIcon symbol="KES" size={20} />
            <span className="font-mono text-sm font-semibold text-white">
              KES
            </span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.,]/g, '');
              setAmount(v);
              setError('');
            }}
            className="w-full min-w-0 bg-transparent text-right font-mono text-2xl font-semibold tracking-tight text-white outline-none placeholder:text-white/20"
          />
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.04] p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
          You receive
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <AssetIcon symbol="BTC" size={20} />
            <span className="font-mono text-sm font-semibold text-white">
              BTC
            </span>
          </div>
          <div className="w-full min-w-0 text-right font-mono text-2xl font-semibold tracking-tight text-white/40">
            —
          </div>
        </div>
      </div>

      {/* Limits hint */}
      <p className="mt-3 text-center text-[11px] text-white/30">
        Guest limit: KES 100 – 100,000 per transaction
      </p>

      {error && (
        <p className="mt-2 text-center text-xs text-red">{error}</p>
      )}

      <Button
        size="lg"
        className="mt-4 h-11 w-full text-sm font-medium"
        disabled={!isValid || loading}
        onClick={handleSubmit}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-vault-black/30 border-t-vault-black" />
            Getting quote…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Get Quote <ArrowRight size={16} />
          </span>
        )}
      </Button>
    </div>
  );
}
