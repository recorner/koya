'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { AmountStep } from './amount-step';
import { QuoteStep } from './quote-step';
import { IdentityStep } from './identity-step';
import { PayoutStep } from './payout-step';
import { PaymentPendingStep } from './payment-pending-step';
import { ProcessingStep } from './processing-step';
import { ResultStep } from './result-step';
import { conversionApi } from '@/lib/api/conversion';
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
  expiresAt: string | null;
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
  expiresAt: null,
};

export function ConversionWizard() {
  const searchParams = useSearchParams();
  const initialAmount = searchParams.get('amount') ?? undefined;
  const initialFrom = searchParams.get('from') ?? 'KES';
  const initialTo = searchParams.get('to') ?? 'BTC';
  const trackingRef = searchParams.get('ref') ?? undefined;

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

  // Tracking mode: fetch status by reference and show ProcessingStep or ResultStep
  if (trackingRef) {
    return <TrackingFlow referenceCode={trackingRef} />;
  }

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:rounded-3xl sm:p-7">

        {/* Progress indicator */}
        <StepProgress
          currentStep={state.step}
          canGoBack={canGoBack}
          onBack={handleBack}
        />

        {state.expiresAt && ['identity', 'payout', 'payment'].includes(state.step) && (
          <ExpiryCountdown
            expiresAt={state.expiresAt}
            onExpired={() => {
              setDirection(1);
              setState(DEFAULT_STATE);
            }}
          />
        )}

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
                initialFrom={initialFrom}
                initialTo={initialTo}
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
                    expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
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
    <div className="mb-6 w-full">
      {canGoBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-white/45 transition-colors hover:text-white/70"
          aria-label="Go back"
        >
          <ChevronLeft size={14} />
          <span className="text-[11px] font-medium">Back</span>
        </button>
      )}
      <div className="flex w-full items-center gap-1">
        {STEPS.map((step, i) => (
          <div key={step} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div
              className={`h-1 w-full rounded-full transition-colors duration-300 ${
                i <= currentIndex
                  ? 'bg-gold'
                  : 'bg-white/8'
              }`}
            />
            <span
              className={`hidden text-[9px] font-semibold uppercase tracking-[0.15em] whitespace-nowrap transition-colors duration-300 sm:block ${
                i <= currentIndex ? 'text-white/70' : 'text-white/25'
              }`}
            >
              {STEP_LABELS[step]}
            </span>
          </div>
        ))}
      </div>
      {/* Mobile: show current step label below the bar */}
      <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50 sm:hidden">
        Step {currentIndex + 1} of {STEPS.length} — {STEP_LABELS[currentStep]}
      </p>
    </div>
  );
}

/* ── Expiry Countdown ────────────────────────────────────────── */

function ExpiryCountdown({
  expiresAt,
  onExpired,
}: {
  expiresAt: string;
  onExpired: () => void;
}) {
  const [remaining, setRemaining] = useState(() => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });

  useEffect(() => {
    const tick = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(ms / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        clearInterval(tick);
        onExpired();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [expiresAt, onExpired]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining < 120;

  return (
    <div className="mb-4 flex items-center justify-center gap-1.5">
      <span
        className={`text-xs font-medium tabular-nums ${
          isUrgent ? 'text-red-400' : 'text-white/40'
        }`}
      >
        Order expires in {mins}:{secs.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

/* ── Tracking Flow (reuses ProcessingStep & ResultStep) ─────────── */

function TrackingFlow({ referenceCode }: { referenceCode: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [view, setView] = useState<'processing' | 'result'>('processing');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await conversionApi.getStatusByReference(referenceCode);
        if (cancelled) return;
        setStatus(res);
      } catch {
        if (!cancelled) setError('Order not found or invalid reference code.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [referenceCode]);

  // Build a minimal QuoteResponse so ProcessingStep can show the conversion summary
  const syntheticQuote: QuoteResponse | null = status
    ? {
        quoteId: '',
        sourceAsset: status.sourceAsset ?? 'KES',
        targetAsset: status.targetAsset ?? 'BTC',
        sourceAmount: status.sourceAmount ?? '0',
        targetAmount: status.targetAmount ?? '0',
        rate: '0',
        fee: '0',
        spread: '0',
        expiresAt: '',
      }
    : null;

  const content = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-sm text-white/50">Looking up your order…</p>
        </div>
      );
    }

    if (error || !status) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-red-400">{error ?? 'Order not found.'}</p>
          <a
            href="/convert"
            className="text-sm text-gold underline underline-offset-2 hover:text-gold/80"
          >
            Start a new conversion
          </a>
        </div>
      );
    }

    if (view === 'processing' && status.sessionId) {
      return (
        <ProcessingStep
          sessionId={status.sessionId}
          quote={syntheticQuote}
          onComplete={(finalStatus) => {
            setStatus(finalStatus);
            setView('result');
          }}
        />
      );
    }

    return (
      <ResultStep
        status={status}
        referenceCode={status.referenceCode ?? referenceCode}
        guestRef={status.guestRef ?? null}
        onReset={() => {
          window.location.href = '/convert';
        }}
      />
    );
  };

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:rounded-3xl sm:p-7">
        {content()}
      </div>
    </div>
  );
}
