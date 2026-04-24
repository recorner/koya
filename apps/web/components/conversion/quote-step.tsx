'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssetIcon } from '@/components/marketing/asset-icons';
import { conversionApi, type QuoteResponse } from '@/lib/api/conversion';

export function QuoteStep({
  quote,
  onConfirm,
  onExpired,
}: {
  quote: QuoteResponse;
  onConfirm: (sessionId: string, referenceCode: string) => void;
  onExpired: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const expiresMs = new Date(quote.expiresAt).getTime();
    return Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpired();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          onExpired();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, onExpired]);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const session = await conversionApi.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });
      onConfirm(session.sessionId, session.referenceCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }, [quote.quoteId, onConfirm]);

  const isExpiring = secondsLeft <= 10;

  return (
    <div>
      <h2 className="font-display text-2xl tracking-tight text-white-95">Review quote and lock session</h2>

      <div
        className={`mt-3 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium uppercase tracking-[0.1em] ${
          isExpiring ? 'border-red/40 bg-red/10 text-red' : 'border-gold/35 bg-gold/10 text-gold'
        }`}
      >
        {isExpiring ? <AlertTriangle size={14} /> : <Clock size={14} />}
        Quote expires in {secondsLeft}s
      </div>

      <div className="mt-5 space-y-3">
        <QuoteRow label="You send">
          <div className="flex items-center gap-2">
            <AssetIcon symbol={quote.sourceAsset} size={18} />
            <span className="font-mono text-lg tabular-nums text-white">{quote.sourceAmount} {quote.sourceAsset}</span>
          </div>
        </QuoteRow>

        <QuoteRow label="You receive">
          <div className="flex items-center gap-2">
            <AssetIcon symbol={quote.targetAsset} size={18} />
            <span className="font-mono text-lg tabular-nums text-white">{quote.targetAmount} {quote.targetAsset}</span>
          </div>
        </QuoteRow>

        <div className="rounded-md border border-white/10 bg-[#101010] p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-white/42">Rate</span>
            <span className="font-mono text-white/72">
              1 BTC = {parseFloat(quote.rate) > 0 ? Math.round(1 / parseFloat(quote.rate)).toLocaleString('en-US') : '—'} KES
            </span>
          </div>
          <div className="mt-1.5 flex justify-between">
            <span className="text-white/42">Fee</span>
            <span className="font-mono text-white/72">{quote.fee} {quote.sourceAsset}</span>
          </div>
          <div className="mt-1.5 flex justify-between">
            <span className="text-white/42">Spread</span>
            <span className="font-mono text-white/72">{(parseFloat(quote.spread) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-center text-xs text-red">{error}</p>}

      <Button size="lg" className="mt-5 h-11 w-full text-sm" disabled={loading || secondsLeft <= 0} onClick={handleConfirm}>
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-vault-black/30 border-t-vault-black" />
            Confirming...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Continue to identity <ArrowRight size={16} />
          </span>
        )}
      </Button>
    </div>
  );
}

function QuoteRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/12 bg-[#111111] p-3.5">
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
      {children}
    </div>
  );
}
