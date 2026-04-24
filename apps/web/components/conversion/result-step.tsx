'use client';

import { CheckCircle, XCircle, Copy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssetIcon } from '@/components/marketing/asset-icons';
import type { StatusResponse } from '@/lib/api/conversion';

export function ResultStep({
  status,
  referenceCode,
  guestRef,
  onReset,
}: {
  status: StatusResponse | null;
  referenceCode: string | null;
  guestRef: string | null;
  onReset: () => void;
}) {
  const isSuccess = status?.currentState === 'COMPLETED';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="text-center">
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-lg border ${
          isSuccess ? 'border-emerald/40 bg-emerald/10' : 'border-red/40 bg-red/10'
        }`}
      >
        {isSuccess ? <CheckCircle size={30} className="text-emerald" /> : <XCircle size={30} className="text-red" />}
      </div>

      <h2 className="mt-4 font-display text-2xl tracking-tight text-white-95">
        {isSuccess ? 'Conversion complete' : 'Conversion failed'}
      </h2>

      <p className="mt-2 text-sm text-white/54">
        {isSuccess
          ? 'Settlement completed and BTC was sent to the destination address.'
          : 'The conversion could not be completed. Please retry or contact support.'}
      </p>

      {status && (
        <div className="mt-5 space-y-2 text-left">
          {isSuccess && (
            <DetailRow label="Converted amount">
              <div className="flex items-center gap-1.5 sm:gap-3">
                <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-white sm:text-sm">
                  <AssetIcon symbol="KES" size={14} />
                  {status.sourceAmount} KES
                </span>
                <ArrowRight size={10} className="shrink-0 text-white/30 sm:size-3" />
                <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-white sm:text-sm">
                  <AssetIcon symbol="BTC" size={14} />
                  {status.targetAmount} BTC
                </span>
              </div>
            </DetailRow>
          )}

          {referenceCode && (
            <DetailRow label="Reference code">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm tabular-nums text-white">{referenceCode}</span>
                <button type="button" onClick={() => copyToClipboard(referenceCode)} className="text-white/34 hover:text-white/64">
                  <Copy size={12} />
                </button>
              </div>
            </DetailRow>
          )}

          {guestRef && (
            <DetailRow label="Guest ID">
              <span className="font-mono text-sm text-white">{guestRef}</span>
            </DetailRow>
          )}

          {status.txHash && (
            <DetailRow label="TX hash">
              <div className="flex items-center gap-2">
                <span className="max-w-[200px] truncate font-mono text-xs text-white/74">{status.txHash}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(status.txHash ?? '')}
                  className="text-white/34 hover:text-white/64"
                >
                  <Copy size={12} />
                </button>
              </div>
            </DetailRow>
          )}
        </div>
      )}

      <Button size="lg" className="mt-6 h-11 w-full text-sm" onClick={onReset}>
        {isSuccess ? 'Start another conversion' : 'Try again'}
      </Button>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-y-1.5 rounded-md border border-white/10 bg-[#101010] px-3 py-2.5">
      <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
