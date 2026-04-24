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

  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const status = await conversionApi.getStatus(sessionId);

        if (status.currentState !== 'PAYMENT_PENDING') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          onComplete();
          return;
        }
      } catch {
        // retry silently
      }
    }, 3000);
  }, [sessionId, onComplete]);

  const initiatePayment = useCallback(async () => {
    setPhase('initiating');
    setError('');

    try {
      const result = await conversionApi.initiatePayment(sessionId);
      checkoutRequestIdRef.current = result.checkoutRequestId;
      setPhase('waiting');
      startPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate payment');
      setPhase('error');
    }
  }, [sessionId, startPolling]);

  useEffect(() => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;
    initiatePayment();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [initiatePayment]);

  useEffect(() => {
    if (phase !== 'waiting') return;
    const timer = setTimeout(() => setPhase('manual'), 15000);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'manual') return;

    const mockTimeout = setTimeout(async () => {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1';

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
        // ignore mock callback errors
      }
    }, 5000);

    return () => clearTimeout(mockTimeout);
  }, [phase, sessionId]);

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
        setPhase('waiting');
      } else {
        setManualError(result.reason ?? 'Invalid reference code');
        setPhase('manual');
      }
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Failed to verify reference');
      setPhase('manual');
    }
  };

  if (phase === 'error') {
    return (
      <div>
        <h2 className="font-display text-2xl tracking-tight text-white-95">Payment initiation failed</h2>
        <p className="mt-2 text-sm text-red">{error}</p>
        <Button size="lg" className="mt-5 h-11 w-full text-sm" onClick={initiatePayment}>
          Retry payment
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border border-white/12 bg-[#111111]">
        {phase === 'initiating' || phase === 'confirming' ? (
          <Loader2 size={28} className="animate-spin text-gold" />
        ) : phase === 'manual' ? (
          <FileText size={28} className="text-amber" />
        ) : (
          <Smartphone size={28} className="text-emerald" />
        )}
      </div>

      <h2 className="mt-4 font-display text-2xl tracking-tight text-white-95">
        {phase === 'initiating'
          ? 'Initiating payment...'
          : phase === 'confirming'
            ? 'Verifying reference...'
            : phase === 'manual'
              ? 'Confirm manually'
              : 'Approve on your phone'}
      </h2>

      <p className="mt-2 text-sm text-white/54">
        {phase === 'initiating'
          ? 'Sending M-Pesa prompt to your device.'
          : phase === 'confirming'
            ? 'Validating your M-Pesa reference.'
            : phase === 'manual'
              ? "If the prompt didn't appear, enter your M-Pesa confirmation code below."
              : 'Complete the STK prompt with your M-Pesa PIN to continue.'}
      </p>

      {phase === 'waiting' && (
        <>
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-md border border-emerald/30 bg-emerald/10 px-4 py-2.5">
            <MpesaIcon size={18} />
            <span className="text-xs font-medium text-emerald">STK prompt sent</span>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-white/34">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Waiting for confirmation...</span>
          </div>
        </>
      )}

      {(phase === 'manual' || phase === 'confirming') && (
        <div className="mt-5">
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-md border border-amber/30 bg-amber/10 px-4 py-2.5">
            <MpesaIcon size={18} />
            <span className="text-xs font-medium text-amber">No automatic confirmation yet</span>
          </div>

          <div className="mt-4 space-y-3">
            <Input
              placeholder="e.g. RK31AQJ9XP"
              value={manualRef}
              onChange={(e) => {
                setManualRef(e.target.value);
                setManualError('');
              }}
              className="h-11 border-white/12 bg-[#111111]"
              disabled={phase === 'confirming'}
            />
            {manualError && <p className="text-left text-xs text-red">{manualError}</p>}
            <Button
              size="lg"
              className="h-11 w-full text-sm"
              onClick={handleManualConfirm}
              disabled={phase === 'confirming' || !manualRef.trim()}
            >
              {phase === 'confirming' ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Verifying...
                </span>
              ) : (
                'Confirm with reference'
              )}
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-white/34">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Still listening for automatic callback...</span>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-md border border-white/10 bg-[#101010] p-3">
        <div className="flex justify-between text-xs">
          <span className="text-white/40">Reference</span>
          <span className="font-mono text-white/74">{referenceCode}</span>
        </div>
      </div>
    </div>
  );
}
