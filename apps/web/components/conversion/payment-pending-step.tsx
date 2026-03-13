'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Smartphone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MpesaIcon } from '@/components/marketing/asset-icons';
import { conversionApi, type StatusResponse } from '@/lib/api/conversion';

export function PaymentPendingStep({
  sessionId,
  referenceCode,
  onComplete,
}: {
  sessionId: string;
  referenceCode: string;
  onComplete: (status: StatusResponse) => void;
}) {
  const [phase, setPhase] = useState<'initiating' | 'waiting' | 'error'>(
    'initiating',
  );
  const [error, setError] = useState('');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const initiatedRef = useRef(false);

  // Initiate STK push on mount
  useEffect(() => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;

    (async () => {
      try {
        await conversionApi.initiatePayment(sessionId);
        setPhase('waiting');
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

        if (
          status.currentState === 'COMPLETED' ||
          status.currentState === 'FAILED' ||
          status.currentState === 'EXPIRED'
        ) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          onComplete(status);
        }
      } catch {
        // Silently retry on network errors
      }
    }, 3000);
  }, [sessionId, onComplete]);

  // For mock: simulate callback after 5 seconds
  useEffect(() => {
    if (phase !== 'waiting') return;

    const mockTimeout = setTimeout(async () => {
      try {
        // Simulate M-Pesa callback to our API
        const API_BASE =
          process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1';

        // First get current status to find checkoutRequestId
        const status = await conversionApi.getStatus(sessionId);

        if (status.currentState === 'PAYMENT_PENDING') {
          // Fire mock callback
          await fetch(`${API_BASE}/payments/mpesa/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              Body: {
                stkCallback: {
                  MerchantRequestID: 'MOCK-MR',
                  CheckoutRequestID: `session-${sessionId}`,
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
  }, [phase, sessionId]);

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
        {phase === 'initiating' ? (
          <Loader2 size={28} className="animate-spin text-gold" />
        ) : (
          <Smartphone size={28} className="text-emerald" />
        )}
      </div>

      <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-white">
        {phase === 'initiating'
          ? 'Initiating payment…'
          : 'Check your phone'}
      </h2>

      <p className="mt-2 text-sm text-white/50">
        {phase === 'initiating'
          ? 'Sending M-Pesa STK push to your phone…'
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

      <div className="mt-5 rounded-xl border border-white/6 bg-white/[0.03] p-3">
        <div className="flex justify-between text-xs">
          <span className="text-white/40">Reference</span>
          <span className="font-mono text-white/70">{referenceCode}</span>
        </div>
      </div>
    </div>
  );
}
