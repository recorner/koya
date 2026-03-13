'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Loader2,
  ArrowRight,
  CircleDot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssetIcon } from '@/components/marketing/asset-icons';
import { conversionApi, type QuoteResponse, type StatusResponse } from '@/lib/api/conversion';

type ProcessingPhase =
  | 'payment_confirmed'
  | 'executing'
  | 'delivering'
  | 'completed'
  | 'failed';

interface StageInfo {
  key: ProcessingPhase;
  label: string;
  description: string;
}

const STAGES: StageInfo[] = [
  {
    key: 'payment_confirmed',
    label: 'Payment received',
    description: 'M-Pesa payment confirmed',
  },
  {
    key: 'executing',
    label: 'Converting',
    description: 'Executing KES → BTC conversion',
  },
  {
    key: 'delivering',
    label: 'Sending BTC',
    description: 'Broadcasting to your wallet',
  },
  {
    key: 'completed',
    label: 'BTC sent',
    description: 'Transaction confirmed',
  },
];

/**
 * Maps backend ConversionState to a processing phase index.
 */
function stateToPhaseIndex(state: string): number {
  switch (state) {
    case 'PAYMENT_CONFIRMED':
      return 0;
    case 'EXECUTION_PENDING':
      return 1;
    case 'DELIVERY_PENDING':
      return 2;
    case 'COMPLETED':
      return 3;
    case 'FAILED':
    case 'EXPIRED':
      return -1;
    default:
      return -1;
  }
}

export function ProcessingStep({
  sessionId,
  quote,
  onComplete,
}: {
  sessionId: string;
  quote: QuoteResponse | null;
  onComplete: (status: StatusResponse) => void;
}) {
  const [currentStage, setCurrentStage] = useState(0);
  const [failed, setFailed] = useState(false);
  const [finalStatus, setFinalStatus] = useState<StatusResponse | null>(null);
  const [revealedStages, setRevealedStages] = useState(1); // starts with first stage visible
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const backendStageRef = useRef(0);

  // Poll backend for status
  const pollStatus = useCallback(async () => {
    try {
      const status = await conversionApi.getStatus(sessionId);
      const phaseIndex = stateToPhaseIndex(status.currentState);

      if (phaseIndex === -1 && (status.currentState === 'FAILED' || status.currentState === 'EXPIRED')) {
        setFailed(true);
        setFinalStatus(status);
        if (pollingRef.current) clearInterval(pollingRef.current);
        return;
      }

      if (phaseIndex >= 0) {
        backendStageRef.current = phaseIndex;
      }

      if (status.currentState === 'COMPLETED') {
        setFinalStatus(status);
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    } catch {
      // Silently retry
    }
  }, [sessionId]);

  // Start polling on mount
  useEffect(() => {
    pollStatus(); // initial fetch
    pollingRef.current = setInterval(pollStatus, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollStatus]);

  // Animate through stages with a stagger — driven by backend + minimum reveal timing
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStage((prev) => {
        // Only advance if backend has reached that stage
        const nextStage = prev + 1;
        if (nextStage > 3) return prev; // max
        if (nextStage <= backendStageRef.current) {
          return nextStage;
        }
        return prev;
      });
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  // Reveal stages with a slight delay for animation
  useEffect(() => {
    setRevealedStages(currentStage + 1);
  }, [currentStage]);

  const isComplete = currentStage >= 3 && finalStatus != null;

  return (
    <div>
      <div className="text-center">
        <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">
          {failed
            ? 'Conversion failed'
            : isComplete
              ? 'Conversion complete'
              : 'Processing your conversion'}
        </h2>
        <p className="mt-2 text-sm text-white/50">
          {failed
            ? 'Something went wrong. Please contact support.'
            : isComplete
              ? 'Your BTC has been sent to your wallet.'
              : 'This usually takes a few seconds.'}
        </p>
      </div>

      {/* Conversion summary */}
      {quote && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2">
            <AssetIcon symbol="KES" size={16} />
            <span className="font-mono text-sm font-semibold text-white">
              {quote.sourceAmount}
            </span>
          </div>
          <ArrowRight size={14} className="text-white/30" />
          <div className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2">
            <AssetIcon symbol="BTC" size={16} />
            <span className="font-mono text-sm font-semibold text-white">
              {quote.targetAmount}
            </span>
          </div>
        </div>
      )}

      {/* Stage progress */}
      <div className="mt-6 space-y-1">
        {STAGES.map((stage, i) => {
          const isRevealed = i < revealedStages;
          const isActive = i === currentStage && !isComplete && !failed;
          const isDone = i < currentStage || (i === currentStage && isComplete);

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, y: 12 }}
              animate={
                isRevealed
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 12 }
              }
              transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
            >
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
                  isDone
                    ? 'border-emerald/20 bg-emerald/[0.06]'
                    : isActive
                      ? 'border-gold/20 bg-gold/[0.06]'
                      : 'border-white/6 bg-white/[0.02]'
                }`}
              >
                {/* Icon */}
                <div className="flex h-7 w-7 items-center justify-center">
                  {isDone ? (
                    <CheckCircle
                      size={18}
                      className="text-emerald"
                    />
                  ) : isActive ? (
                    <Loader2
                      size={18}
                      className="animate-spin text-gold"
                    />
                  ) : (
                    <CircleDot size={18} className="text-white/20" />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium transition-colors duration-300 ${
                      isDone
                        ? 'text-emerald'
                        : isActive
                          ? 'text-white'
                          : 'text-white/30'
                    }`}
                  >
                    {stage.label}
                  </p>
                  <p
                    className={`text-xs transition-colors duration-300 ${
                      isDone
                        ? 'text-emerald/60'
                        : isActive
                          ? 'text-white/50'
                          : 'text-white/15'
                    }`}
                  >
                    {stage.description}
                  </p>
                </div>

                {/* Status indicator */}
                {isDone && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald/70">
                    Done
                  </span>
                )}
                {isActive && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gold/70">
                    In progress
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* TX Hash when complete */}
      {isComplete && finalStatus?.txHash && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-4 rounded-xl border border-white/6 bg-white/[0.03] p-3"
        >
          <div className="flex justify-between text-xs">
            <span className="text-white/40">TX Hash</span>
            <span className="max-w-[220px] truncate font-mono text-white/70">
              {finalStatus.txHash}
            </span>
          </div>
        </motion.div>
      )}

      {/* CTA */}
      {(isComplete || failed) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <Button
            size="lg"
            className="mt-5 h-11 w-full text-sm font-medium"
            onClick={() => onComplete(finalStatus!)}
          >
            {isComplete ? 'View Details' : 'View Details'}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
