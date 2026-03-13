'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Smartphone, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MpesaIcon } from '@/components/marketing/asset-icons';
import { conversionApi } from '@/lib/api/conversion';

export function PaymentPendingStep({
  sessionId,
  referenceCode,
  onComplete,
}: {
  sessionId: string;
  referenceCode: string;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<'initiating' | 'waiting' | 'manual' | 'confirming' | 'error'>(
    'initiating',
  );
  const [error, setError] = useState('');
  const [manualRef, setManualRef] = useState('');
  const [manualError, setManualError] = useState('');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const initiatedRef = useRef(false);
  const checkoutRequestIdRef = useRef<string | null>(null);
  const waitingStartRef = useRef<number>(0);

  // Initiate STK push on mount
  useEffect(() => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;

    (async () => {
      try {
        const result = await conversionApi.initiatePayment(sessionId);
        checkoutRequestIdRef.current = result.checkoutRequestId;
        setPhase('waiting');
        waitingStartRef.current = Date.now();
        startPolling();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to initiate payment',
        );
        setPhase('error');
      }
    })();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPolling = useCallback(() => {
    pollingRef.current = setInterval(async () => {
      try {
        const status = await conversionApi.getStatus(sessionId);

        // Payment has been processed — hand off to the processing step
        if (status.currentState !== 'PAYMENT_PENDING') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          onComplete();
          return;
        }

        // After 15 seconds, show manual reference option
        if (
          waitingStartRef.current &&
          Date.now() - waitingStartRef.current > 15000 &&
          phase === 'waiting'
        ) {
          setPhase('manual');
        }
      } catch {
        // Silently retry on network errors
      }
    }, 3000);
  }, [sessionId, onComplete, phase]);

  // Show manual input after 15s timeout
  useEffect(() => {
    if (phase !== 'waiting') return;
    const timer = setTimeout(() => setPhase('manual'), 15000);
    return () => clearTimeout(timer);
  }, [phase]);

  // For mock: simulate callback after 5 seconds using the real checkoutRequestId
  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'manual') return;

    const mockTimeout = setTimeout(async () => {
      try {
        const API_BASE =
          process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1';

        const checkoutId = checkoutRequestIdRef.current;
        if (!checkoutId) return;

        const status = await conversionApi.getStatus(sessionId);

        if (status.currentState === 'PAYMENT_PENDING') {
          await fetch(`${API_BASE}/payments/mpesa/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              Body: {
                stkCallback: {
                  MerchantRequestID: 'MOCK-MR',
                  CheckoutRequestID: checkoutId,
                  ResultCode: 0,
                  ResultDesc: 'The service request is processed successfully.',
                  CallbackMetadata: {
                    Item: [
                      { Name: 'Amount', Value: 1000 },
                      { Name: 'MpesaReceiptNumber', Value: 'MOCK_RECEIPT' },
                    ],
                  },
                },
              },
            }),
          });
        }
      } catch {
        // Ignore mock callback errors
      }
    }, 5000);

    return () => clearTimeout(mockTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualConfirm = async () => {
    const trimmed = manualRef.trim().toUpperCase();
    if (!trimmed) {
      setManualError('Enter your M-Pesa reference code');
      return;
    }

    setManualError('');
    setPhase('confirming');

    try {
      const result = await conversionApi.confirmReference(sessionId, trimmed);

      if (result.confirmed) {
        // Continue polling — processPaymentConfirmation will advance the state
        setPhase('waiting');
        waitingStartRef.current = Date.now();
      } else {
        setManualError(result.reason ?? 'Invalid reference code');
        setPhase('manual');
      }
    } catch (err) {
      setManualError(
        err instanceof Error ? err.message : 'Failed to verify reference',
      );
      setPhase('manual');
    }
  };

  if (phase === 'error') {
    return (
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-white">
          Payment failed
        </h2>
        <p className="mt-2 text-sm text-red">{error}</p>
        <Button
          size="lg"
          className="mt-5 h-11 w-full text-sm font-medium"
          onClick={() => {
            setPhase('initiating');
            setError('');
            initiatedRef.current = false;
          }}
        >
          Retry Payment
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
        {phase === 'initiating' || phase === 'confirming' ? (
          <Loader2 size={28} className="animate-spin text-gold" />
        ) : phase === 'manual' ? (
          <FileText size={28} className="text-amber" />
        ) : (
          <Smartphone size={28} className="text-emerald" />
        )}
      </div>

      <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-white">
        {phase === 'initiating'
          ? 'Initiating payment…'
          : phase === 'confirming'
            ? 'Verifying reference…'
            : phase === 'manual'
              ? 'Confirm manually'
              : 'Check your phone'}
      </h2>

      <p className="mt-2 text-sm text-white/50">
        {phase === 'initiating'
          ? 'Sending M-Pesa STK push to your phone…'
          : phase === 'confirming'
            ? 'Checking your M-Pesa reference…'
            : phase === 'manual'
              ? 'Didn\'t get the prompt? Enter your M-Pesa confirmation code below.'
              : 'Enter your M-Pesa PIN on your phone to complete the payment.'}
      </p>

      {phase === 'waiting' && (
        <>
          <div className="mx-auto mt-5 flex items-center justify-center gap-2 rounded-xl border border-emerald/20 bg-emerald/5 px-4 py-2.5">
            <MpesaIcon size={18} />
            <span className="text-xs font-semibold text-emerald">
              STK Push sent
            </span>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-white/30">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Waiting for confirmation…</span>
          </div>
        </>
      )}

      {(phase === 'manual' || phase === 'confirming') && (
        <div className="mt-5">
          <div className="mx-auto mb-3 flex items-center justify-center gap-2 rounded-xl border border-amber/20 bg-amber/5 px-4 py-2.5">
            <MpesaIcon size={18} />
            <span className="text-xs font-semibold text-amber">
              No confirmation received
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <Input
              placeholder="e.g. RK31AQJ9XP"
              value={manualRef}
              onChange={(e) => {
                setManualRef(e.target.value);
                setManualError('');
              }}
              className="h-11 border-white/10 bg-white/[0.04] font-mono text-sm text-white placeholder:text-white/25"
              disabled={phase === 'confirming'}
            />
            {manualError && (
              <p className="text-left text-xs text-red">{manualError}</p>
            )}
            <Button
              size="lg"
              className="h-11 w-full text-sm font-medium"
              onClick={handleManualConfirm}
              disabled={phase === 'confirming' || !manualRef.trim()}
            >
              {phase === 'confirming' ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Verifying…
                </span>
              ) : (
                'Confirm with Reference'
              )}
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-white/30">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Still listening for automatic confirmation…</span>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-xl border border-white/6 bg-white/[0.03] p-3">
        <div className="flex justify-between text-xs">
          <span className="text-white/40">Reference</span>
          <span className="font-mono text-white/70">{referenceCode}</span>
        </div>
      </div>
    </div>
  );
}
