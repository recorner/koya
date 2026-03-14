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
      {/* Status icon */}
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${
          isSuccess
            ? 'border-emerald/30 bg-emerald/10'
            : 'border-red/30 bg-red/10'
        }`}
      >
        {isSuccess ? (
          <CheckCircle size={32} className="text-emerald" />
        ) : (
          <XCircle size={32} className="text-red" />
        )}
      </div>

      <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
        {isSuccess ? 'Conversion complete' : 'Conversion failed'}
      </h2>

      <p className="mt-2 text-sm text-white/50">
        {isSuccess
          ? 'Your BTC has been sent to the provided address.'
          : 'Something went wrong. Please try again or contact support.'}
      </p>

      {/* Details */}
      {status && (
        <div className="mt-5 space-y-2 text-left">
          {isSuccess && (
            <DetailRow label="Converted">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 font-mono text-sm text-white">
                  <AssetIcon symbol="KES" size={14} />
                  {status.sourceAmount} KES
                </span>
                <ArrowRight size={12} className="text-white/30" />
                <span className="flex items-center gap-1.5 font-mono text-sm text-white">
                  <AssetIcon symbol="BTC" size={14} />
                  {status.targetAmount} BTC
                </span>
              </div>
            </DetailRow>
          )}

          {referenceCode && (
            <DetailRow label="Reference">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white">
                  {referenceCode}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(referenceCode)}
                  className="text-white/30 hover:text-white/60"
                >
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
            <DetailRow label="TX Hash">
              <div className="flex items-center gap-2">
                <span className="max-w-[200px] truncate font-mono text-xs text-white/70">
                  {status.txHash}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(status.txHash ?? '')}
                  className="text-white/30 hover:text-white/60"
                >
                  <Copy size={12} />
                </button>
              </div>
            </DetailRow>
          )}
        </div>
      )}

      <Button
        size="lg"
        className="mt-6 h-11 w-full text-sm font-medium"
        onClick={onReset}
      >
        {isSuccess ? 'Convert Again' : 'Try Again'}
      </Button>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
        {label}
      </span>
      {children}
    </div>
  );
}
