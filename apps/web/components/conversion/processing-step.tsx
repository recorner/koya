'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, ArrowRight, CircleDot } from 'lucide-react';
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
  { key: 'payment_confirmed', label: 'Payment received', description: 'M-Pesa payment confirmed.' },
  { key: 'executing', label: 'Executing conversion', description: 'Converting KES to BTC at locked terms.' },
  { key: 'delivering', label: 'Broadcasting transfer', description: 'Sending BTC to your destination wallet.' },
  { key: 'completed', label: 'Settlement complete', description: 'Transaction finalized.' },
];

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
  const [revealedStages, setRevealedStages] = useState(1);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const backendStageRef = useRef(0);

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
      // retry silently
    }
  }, [sessionId]);

  useEffect(() => {
    pollStatus();
    pollingRef.current = setInterval(pollStatus, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollStatus]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStage((prev) => {
        const nextStage = prev + 1;
        if (nextStage > 3) return prev;
        if (nextStage <= backendStageRef.current) return nextStage;
        return prev;
      });
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setRevealedStages(currentStage + 1);
  }, [currentStage]);

  const isComplete = currentStage >= 3 && finalStatus != null;

  return (
    <div>
      <div className="text-center">
        <h2 className="font-display text-2xl tracking-tight text-white-95">
          {failed ? 'Conversion failed' : isComplete ? 'Conversion complete' : 'Processing conversion'}
        </h2>
        <p className="mt-2 text-sm text-white/54">
          {failed
            ? 'An issue occurred during settlement. View details below.'
            : isComplete
              ? 'BTC delivery has been finalized to your provided address.'
              : 'This process typically completes in under a minute.'}
        </p>
      </div>

      {quote && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-[#111111] px-3 py-2">
            <AssetIcon symbol="KES" size={16} />
            <span className="font-mono text-sm tabular-nums text-white">{quote.sourceAmount}</span>
          </div>
          <ArrowRight size={14} className="text-white/30" />
          <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-[#111111] px-3 py-2">
            <AssetIcon symbol="BTC" size={16} />
            <span className="font-mono text-sm tabular-nums text-white">{quote.targetAmount}</span>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-1.5">
        {STAGES.map((stage, i) => {
          const isRevealed = i < revealedStages;
          const isActive = i === currentStage && !isComplete && !failed;
          const isDone = i < currentStage || (i === currentStage && isComplete);

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, y: 12 }}
              animate={isRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.35, delay: i * 0.08, ease: 'easeOut' }}
            >
              <div
                className={`flex items-center gap-3 rounded-md border px-4 py-3 ${
                  isDone
                    ? 'border-emerald/30 bg-emerald/10'
                    : isActive
                      ? 'border-gold/30 bg-gold/10'
                      : 'border-white/10 bg-[#111111]'
                }`}
              >
                <div className="flex h-7 w-7 items-center justify-center">
                  {isDone ? (
                    <CheckCircle size={18} className="text-emerald" />
                  ) : isActive ? (
                    <Loader2 size={18} className="animate-spin text-gold" />
                  ) : (
                    <CircleDot size={18} className="text-white/28" />
                  )}
                </div>

                <div className="flex-1 text-left">
                  <p className={`text-sm font-medium ${isDone ? 'text-emerald' : isActive ? 'text-white' : 'text-white/42'}`}>
                    {stage.label}
                  </p>
                  <p className={`text-xs ${isDone ? 'text-emerald/70' : isActive ? 'text-white/58' : 'text-white/28'}`}>
                    {stage.description}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {isComplete && finalStatus?.txHash && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="mt-4 rounded-md border border-white/10 bg-[#101010] p-3"
        >
          <div className="flex justify-between text-xs">
            <span className="text-white/42">TX Hash</span>
            <span className="max-w-[220px] truncate font-mono text-white/72">{finalStatus.txHash}</span>
          </div>
        </motion.div>
      )}

      {(isComplete || failed) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.4 }}>
          <Button
            size="lg"
            className="mt-5 h-11 w-full text-sm"
            onClick={() => onComplete(finalStatus as NonNullable<typeof finalStatus>)}
          >
            View details
          </Button>
        </motion.div>
      )}
    </div>
  );
}
