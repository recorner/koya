'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
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
  enter: { opacity: 0, y: 24 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

export function ConversionWizard() {
  const searchParams = useSearchParams();
  const initialAmount = searchParams.get('amount') ?? undefined;

  const [state, setState] = useState<WizardState>({
    step: 'amount',
    quote: null,
    sessionId: null,
    referenceCode: null,
    guestRef: null,
    finalStatus: null,
  });

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.45)] backdrop-blur-md sm:rounded-3xl sm:p-7">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[rgba(212,175,55,0.08)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[rgba(0,229,255,0.05)] blur-2xl" />

        {/* Progress indicator */}
        <StepProgress currentStep={state.step} />

        <AnimatePresence mode="wait">
          <motion.div
            key={state.step}
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
                  setState((s) => ({ ...s, step: 'quote', quote }))
                }
              />
            )}
            {state.step === 'quote' && state.quote && (
              <QuoteStep
                quote={state.quote}
                onConfirm={(sessionId, referenceCode) =>
                  setState((s) => ({
                    ...s,
                    step: 'identity',
                    sessionId,
                    referenceCode,
                  }))
                }
                onExpired={() =>
                  setState((s) => ({ ...s, step: 'amount', quote: null }))
                }
              />
            )}
            {state.step === 'identity' && state.sessionId && (
              <IdentityStep
                sessionId={state.sessionId}
                onComplete={(guestRef) =>
                  setState((s) => ({ ...s, step: 'payout', guestRef }))
                }
              />
            )}
            {state.step === 'payout' && state.sessionId && (
              <PayoutStep
                sessionId={state.sessionId}
                onComplete={() =>
                  setState((s) => ({ ...s, step: 'payment' }))
                }
              />
            )}
            {state.step === 'payment' && state.sessionId && (
              <PaymentPendingStep
                sessionId={state.sessionId}
                referenceCode={state.referenceCode ?? ''}
                onComplete={() =>
                  setState((s) => ({
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
                  setState((s) => ({
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
                onReset={() =>
                  setState({
                    step: 'amount',
                    quote: null,
                    sessionId: null,
                    referenceCode: null,
                    guestRef: null,
                    finalStatus: null,
                  })
                }
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

function StepProgress({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <div className="mb-6 flex items-center gap-1">
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
  );
}
