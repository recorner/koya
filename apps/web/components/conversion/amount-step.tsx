'use client';

import { useState, useMemo, useCallback } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssetIcon } from '@/components/marketing/asset-icons';
import { useLiveRate } from '@/lib/hooks/use-realtime-rates';
import { conversionApi, type QuoteResponse } from '@/lib/api/conversion';

export function AmountStep({
  onQuoteReady,
  initialAmount,
  initialFrom = 'KES',
  initialTo = 'BTC',
}: {
  onQuoteReady: (quote: QuoteResponse) => void;
  initialAmount?: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  const [amount, setAmount] = useState(initialAmount ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sourceAsset = initialFrom;
  const targetAsset = initialTo;

  const numericAmount = useMemo(() => {
    const val = parseFloat(amount.replace(/,/g, ''));
    return !val || val <= 0 ? 0 : val;
  }, [amount]);

  const isValid = numericAmount >= 100 && numericAmount <= 100_000;

  const rate = useLiveRate(sourceAsset, targetAsset);
  const isCryptoTarget = ['BTC', 'ETH'].includes(targetAsset);
  const previewDest = useMemo(() => {
    if (!numericAmount || !rate) return '';
    const result = numericAmount * rate;
    return isCryptoTarget ? result.toFixed(8) : result.toFixed(2);
  }, [numericAmount, rate, isCryptoTarget]);

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');

    try {
      const quote = await conversionApi.createQuote({
        sourceAsset,
        targetAsset,
        sourceAmount: numericAmount.toString(),
        channel: 'WEB',
      });
      onQuoteReady(quote);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get quote');
    } finally {
      setLoading(false);
    }
  }, [isValid, sourceAsset, targetAsset, numericAmount, onQuoteReady]);

  return (
    <div>
      <h2 className="font-display text-2xl tracking-tight text-white-95">Set your conversion amount</h2>
      <p className="mt-1.5 text-sm text-white/54">Enter the amount in {sourceAsset}. You can review and confirm pricing in the next step.</p>

      <div className="mt-6 rounded-lg border border-white/12 bg-[#111111] p-4">
        <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40">You send</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-white/12 bg-[#0f0f0f] px-3 py-2">
            <AssetIcon symbol={sourceAsset} size={18} />
            <span className="font-mono text-sm text-white/88">{sourceAsset}</span>
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
            className="w-full min-w-0 bg-transparent text-right font-mono text-2xl font-semibold tabular-nums text-white outline-none placeholder:text-white/20"
          />
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/12 bg-[#111111] p-4">
        <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40">Estimated receive</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-white/12 bg-[#0f0f0f] px-3 py-2">
            <AssetIcon symbol={targetAsset} size={18} />
            <span className="font-mono text-sm text-white/88">{targetAsset}</span>
          </div>
          <div className="w-full min-w-0 text-right font-mono text-2xl font-semibold tabular-nums text-white">
            {previewDest || <span className="text-white/22">{isCryptoTarget ? '0.00000000' : '0.00'}</span>}
          </div>
        </div>
      </div>

      {numericAmount > 0 && rate > 0 && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-md border border-white/10 bg-[#101010] px-3 py-2">
          <RefreshCw size={10} className="text-white/25" />
          <span className="font-mono text-[11px] tabular-nums text-white/52">
            {rate < 0.01
              ? `1 ${targetAsset} ≈ ${Math.round(1 / rate).toLocaleString('en-US')} ${sourceAsset}`
              : `1 ${sourceAsset} ≈ ${rate.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${targetAsset}`}
          </span>
        </div>
      )}

      <p className="mt-2 text-center text-[11px] text-white/34">Guest transaction range: {sourceAsset} 100 to 100,000</p>

      {error && <p className="mt-2 text-center text-xs text-red">{error}</p>}

      <Button size="lg" className="mt-4 h-11 w-full text-sm" disabled={!isValid || loading} onClick={handleSubmit}>
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-vault-black/30 border-t-vault-black" />
            Getting quote...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Continue to quote <ArrowRight size={16} />
          </span>
        )}
      </Button>
    </div>
  );
}
