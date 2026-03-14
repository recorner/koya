'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { AmountStep } from './amount-step';
import { QuoteStep } from './quote-step';
import { IdentityStep } from './identity-step';
import { PayoutStep } from './payout-step';
import { PaymentPendingStep } from './payment-pending-step';
import { ProcessingStep } from './processing-step';
import { ResultStep } from './result-step';
import type { QuoteResponse, StatusResponse } from '@/lib/api/conversion';

export type WizardStep =
  | 'amount'
  | 'quote'
  | 'identity'
  | 'payout'
  | 'payment'
  | 'processing'
  | 'result';

export interface WizardState {
  step: WizardStep;
  quote: QuoteResponse | null;
  sessionId: string | null;
  referenceCode: string | null;
  guestRef: string | null;
  finalStatus: StatusResponse | null;
}

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, y: dir * 24 }),
  center: { opacity: 1, y: 0 },
  exit: (dir: number) => ({ opacity: 0, y: dir * -16 }),
};

const STORAGE_KEY = 'koya-conversion-wizard';
const BACK_ALLOWED: WizardStep[] = ['quote', 'identity', 'payout', 'payment'];
const DEFAULT_STATE: WizardState = {
  step: 'amount',
  quote: null,
  sessionId: null,
  referenceCode: null,
  guestRef: null,
  finalStatus: null,
};

export function ConversionWizard() {
  const searchParams = useSearchParams();
  const initialAmount = searchParams.get('amount') ?? undefined;

  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [direction, setDirection] = useState(1);
  const [isReady, setIsReady] = useState(false);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WizardState;
        if (STEPS.includes(parsed.step)) {
          setState(parsed);
        }
      }
    } catch {
      /* ignore */
    }
    setIsReady(true);
  }, []);

  // Persist state to sessionStorage on changes
  useEffect(() => {
    if (!isReady) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, isReady]);

  const goForward = useCallback(
    (updater: (s: WizardState) => WizardState) => {
      setDirection(1);
      setState(updater);
    },
    [],
  );

  const handleBack = useCallback(() => {
    const currentIndex = STEPS.indexOf(state.step);
    if (currentIndex <= 0) return;
    const prevStep = STEPS[currentIndex - 1] as WizardStep;
    setDirection(-1);
    setState((s) => ({ ...s, step: prevStep }));
  }, [state.step]);

  const canGoBack = BACK_ALLOWED.includes(state.step);

  if (!isReady) {
    return (
      <div className="mx-auto w-full max-w-[520px]">
        <div className="h-80 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] sm:rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.45)] backdrop-blur-md sm:rounded-3xl sm:p-7">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[rgba(212,175,55,0.08)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[rgba(0,229,255,0.05)] blur-2xl" />

        {/* Progress indicator */}
        <StepProgress
          currentStep={state.step}
          canGoBack={canGoBack}
          onBack={handleBack}
        />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={state.step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {state.step === 'amount' && (
              <AmountStep
                initialAmount={initialAmount}
                onQuoteReady={(quote) =>
                  goForward((s) => ({ ...s, step: 'quote', quote }))
                }
              />
            )}
            {state.step === 'quote' && state.quote && (
              <QuoteStep
                quote={state.quote}
                onConfirm={(sessionId, referenceCode) =>
                  goForward((s) => ({
                    ...s,
                    step: 'identity',
                    sessionId,
                    referenceCode,
                  }))
                }
                onExpired={() =>
                  goForward((s) => ({ ...s, step: 'amount', quote: null }))
                }
              />
            )}
            {state.step === 'identity' && state.sessionId && (
              <IdentityStep
                sessionId={state.sessionId}
                onComplete={(guestRef) =>
                  goForward((s) => ({ ...s, step: 'payout', guestRef }))
                }
              />
            )}
            {state.step === 'payout' && state.sessionId && (
              <PayoutStep
                sessionId={state.sessionId}
                onComplete={() =>
                  goForward((s) => ({ ...s, step: 'payment' }))
                }
              />
            )}
            {state.step === 'payment' && state.sessionId && (
              <PaymentPendingStep
                sessionId={state.sessionId}
                referenceCode={state.referenceCode ?? ''}
                onComplete={() =>
                  goForward((s) => ({
                    ...s,
                    step: 'processing',
                  }))
                }
              />
            )}
            {state.step === 'processing' && state.sessionId && (
              <ProcessingStep
                sessionId={state.sessionId}
                quote={state.quote}
                onComplete={(status) =>
                  goForward((s) => ({
                    ...s,
                    step: 'result',
                    finalStatus: status,
                  }))
                }
              />
            )}
            {state.step === 'result' && (
              <ResultStep
                status={state.finalStatus}
                referenceCode={state.referenceCode}
                guestRef={state.guestRef}
                onReset={() => {
                  setDirection(1);
                  setState(DEFAULT_STATE);
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const STEPS: WizardStep[] = [
  'amount',
  'quote',
  'identity',
  'payout',
  'payment',
  'processing',
  'result',
];

const STEP_LABELS: Record<WizardStep, string> = {
  amount: 'Amount',
  quote: 'Quote',
  identity: 'Identity',
  payout: 'Address',
  payment: 'Pay',
  processing: 'Process',
  result: 'Done',
};

function StepProgress({
  currentStep,
  canGoBack,
  onBack,
}: {
  currentStep: WizardStep;
  canGoBack: boolean;
  onBack: () => void;
}) {
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <div className="mb-6 flex items-center gap-2">
      {canGoBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80"
          aria-label="Go back"
        >
          <ChevronLeft size={14} />
        </button>
      )}
      <div className="flex flex-1 items-center gap-1">
        {STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`h-1 w-full rounded-full transition-colors duration-300 ${
                i <= currentIndex
                  ? 'bg-gold'
                  : 'bg-white/8'
              }`}
            />
            <span
              className={`text-[9px] font-semibold uppercase tracking-[0.15em] transition-colors duration-300 ${
                i <= currentIndex ? 'text-white/70' : 'text-white/25'
              }`}
            >
              {STEP_LABELS[step]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
