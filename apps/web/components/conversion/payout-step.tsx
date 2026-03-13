'use client';

import { useState, useCallback } from 'react';
import { ArrowRight, Bitcoin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { conversionApi } from '@/lib/api/conversion';

export function PayoutStep({
  sessionId,
  onComplete,
}: {
  sessionId: string;
  onComplete: () => void;
}) {
  const [btcAddress, setBtcAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Basic client-side validation
  const looksValid =
    btcAddress.length >= 26 &&
    (btcAddress.startsWith('1') ||
      btcAddress.startsWith('3') ||
      btcAddress.startsWith('bc1'));

  const handleSubmit = useCallback(async () => {
    if (!looksValid) return;
    setLoading(true);
    setError('');

    try {
      await conversionApi.submitPayoutDetails(sessionId, { btcAddress });
      onComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to submit address',
      );
    } finally {
      setLoading(false);
    }
  }, [looksValid, sessionId, btcAddress, onComplete]);

  return (
    <div>
      <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
        BTC destination
      </h2>
      <p className="mt-1.5 text-sm text-white/50">
        Enter the Bitcoin address where you&apos;d like to receive your BTC.
      </p>

      <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.04] p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Bitcoin size={14} className="text-[#F7931A]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
            Bitcoin Address
          </p>
        </div>
        <input
          type="text"
          placeholder="bc1q... or 1... or 3..."
          value={btcAddress}
          onChange={(e) => {
            setBtcAddress(e.target.value.trim());
            setError('');
          }}
          className="w-full bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/25"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <p className="mt-2 text-center text-[10px] text-white/25">
        Supports P2PKH, P2SH, SegWit (bech32), and Taproot addresses
      </p>

      {error && (
        <p className="mt-2 text-center text-xs text-red">{error}</p>
      )}

      <Button
        size="lg"
        className="mt-5 h-11 w-full text-sm font-medium"
        disabled={!looksValid || loading}
        onClick={handleSubmit}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-vault-black/30 border-t-vault-black" />
            Submitting…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Continue to Payment <ArrowRight size={16} />
          </span>
        )}
      </Button>
    </div>
  );
}
