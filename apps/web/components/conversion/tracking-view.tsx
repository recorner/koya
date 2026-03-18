'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Loader2,
  ArrowRight,
  CircleDot,
  XCircle,
  Copy,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssetIcon } from '@/components/marketing/asset-icons';
import { conversionApi, type StatusResponse } from '@/lib/api/conversion';

interface StageInfo {
  key: string;
  label: string;
  description: string;
}

const STAGES: StageInfo[] = [
  { key: 'identity', label: 'Identity verified', description: 'KYC check passed' },
  { key: 'payout', label: 'BTC address set', description: 'Payout destination saved' },
  { key: 'payment', label: 'Payment received', description: 'M-Pesa payment confirmed' },
  { key: 'executing', label: 'Converting', description: 'Executing KES → BTC swap' },
  { key: 'delivering', label: 'Sending BTC', description: 'Broadcasting to wallet' },
  { key: 'completed', label: 'Complete', description: 'BTC delivered' },
];

function stateToStageIndex(state: string): number {
  switch (state) {
    case 'IDENTITY_PENDING':
    case 'COMPLIANCE_PENDING':
      return 0;
    case 'PAYOUT_DETAILS_PENDING':
      return 1;
    case 'PAYMENT_PENDING':
      return 2;
    case 'PAYMENT_CONFIRMED':
      return 3;
    case 'EXECUTION_PENDING':
      return 4;
    case 'DELIVERY_PENDING':
      return 5;
    case 'COMPLETED':
      return 6; // all stages done
    default:
      return -1;
  }
}

export function TrackingView({ referenceCode }: { referenceCode: string }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await conversionApi.getStatusByReference(referenceCode);
      setStatus(data);
      setError(null);

      // Stop polling if terminal state
      if (['COMPLETED', 'FAILED', 'EXPIRED'].includes(data.currentState)) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order not found');
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  }, [referenceCode]);

  useEffect(() => {
    fetchStatus();
    pollingRef.current = setInterval(fetchStatus, 4000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchStatus]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 size={24} className="animate-spin text-gold" />
        <p className="text-sm text-white/50">Loading order...</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="text-center py-8">
        <XCircle size={32} className="mx-auto text-red/70" />
        <h2 className="mt-3 font-display text-lg font-bold text-white">
          Order not found
        </h2>
        <p className="mt-2 text-sm text-white/50">
          We couldn&apos;t find an order with reference <span className="font-mono text-white/70">{referenceCode}</span>.
        </p>
        <Button
          size="lg"
          className="mt-5 h-11 text-sm font-medium"
          onClick={() => (window.location.href = '/convert')}
        >
          Start New Conversion
        </Button>
      </div>
    );
  }

  const isFailed = status.currentState === 'FAILED';
  const isExpired = status.currentState === 'EXPIRED';
  const isComplete = status.currentState === 'COMPLETED';
  const isTerminal = isComplete || isFailed || isExpired;
  const stageIndex = stateToStageIndex(status.currentState);

  return (
    <div>
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          {isComplete ? (
            <CheckCircle size={28} className="text-emerald" />
          ) : isFailed || isExpired ? (
            <XCircle size={28} className="text-red" />
          ) : (
            <Clock size={28} className="text-gold" />
          )}
        </div>
        <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
          {isComplete
            ? 'Conversion complete'
            : isFailed
              ? 'Conversion failed'
              : isExpired
                ? 'Order expired'
                : 'Order in progress'}
        </h2>
        <p className="mt-1.5 text-sm text-white/50">
          {isComplete
            ? 'Your BTC has been sent to the provided address.'
            : isFailed
              ? 'Something went wrong. Please contact support.'
              : isExpired
                ? 'This order expired before payment was completed.'
                : 'We\'re processing your conversion.'}
        </p>
      </div>

      {/* Order details */}
      <div className="mt-5 space-y-2">
        <DetailRow label="Reference">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-white">{status.referenceCode}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(status.referenceCode)}
              className="text-white/30 hover:text-white/60"
            >
              <Copy size={12} />
            </button>
          </div>
        </DetailRow>

        <DetailRow label="Amount">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <span className="flex items-center gap-1 font-mono text-xs text-white sm:gap-1.5 sm:text-sm">
              <AssetIcon symbol={status.sourceAsset} size={14} />
              {status.sourceAmount} {status.sourceAsset}
            </span>
            <ArrowRight size={10} className="shrink-0 text-white/30 sm:size-3" />
            {status.targetAmount ? (
              <span className="flex items-center gap-1 font-mono text-xs text-white sm:gap-1.5 sm:text-sm">
                <AssetIcon symbol={status.targetAsset} size={14} />
                {status.targetAmount} {status.targetAsset}
              </span>
            ) : (
              <span className="text-xs text-white/30">pending</span>
            )}
          </div>
        </DetailRow>

        {status.guestRef && (
          <DetailRow label="Guest ID">
            <span className="font-mono text-sm text-white/70">{status.guestRef}</span>
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

      {/* Progress stages */}
      {!isExpired && !isFailed && (
        <div className="mt-5 space-y-1">
          {STAGES.map((stage, i) => {
            const isDone = i < stageIndex;
            const isActive = i === stageIndex && !isTerminal;

            return (
              <motion.div
                key={stage.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
              >
                <div
                  className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-all duration-500 ${
                    isDone
                      ? 'border-emerald/20 bg-emerald/[0.06]'
                      : isActive
                        ? 'border-gold/20 bg-gold/[0.06]'
                        : 'border-white/6 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex h-6 w-6 items-center justify-center">
                    {isDone ? (
                      <CheckCircle size={16} className="text-emerald" />
                    ) : isActive ? (
                      <Loader2 size={16} className="animate-spin text-gold" />
                    ) : (
                      <CircleDot size={16} className="text-white/15" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isDone ? 'text-emerald' : isActive ? 'text-white' : 'text-white/25'}`}>
                      {stage.label}
                    </p>
                    <p className={`text-[11px] ${isDone ? 'text-emerald/60' : isActive ? 'text-white/40' : 'text-white/12'}`}>
                      {stage.description}
                    </p>
                  </div>
                  {isDone && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald/70">Done</span>
                  )}
                  {isActive && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-gold/70">In progress</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <Button
        size="lg"
        className="mt-6 h-11 w-full text-sm font-medium"
        onClick={() => (window.location.href = '/convert')}
      >
        {isTerminal ? 'Start New Conversion' : 'Convert More'}
      </Button>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-y-1.5 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
