const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

export interface QuoteResponse {
  quoteId: string;
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
  targetAmount: string;
  rate: string;
  fee: string;
  spread: string;
  expiresAt: string;
}

export interface SessionResponse {
  sessionId: string;
  currentState: string;
  referenceCode: string;
}

export interface IdentityResponse {
  guestRef: string;
  currentState: string;
  compliancePassed: boolean;
  reason?: string;
}

export interface PayoutResponse {
  sessionId: string;
  currentState: string;
}

export interface PaymentResponse {
  sessionId: string;
  currentState: string;
  checkoutRequestId: string;
  phone: string;
}

export interface StatusResponse {
  sessionId: string;
  currentState: string;
  referenceCode: string;
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
  targetAmount: string | null;
  guestRef: string | null;
  txHash: string | null;
  createdAt: string;
}

export const conversionApi = {
  createQuote: (data: {
    sourceAsset: string;
    targetAsset: string;
    sourceAmount: string;
    channel: string;
  }) =>
    request<QuoteResponse>('/guest-conversion/quote', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createSession: (data: { quoteId: string; channel: string }) =>
    request<SessionResponse>('/guest-conversion/session', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  submitIdentity: (
    sessionId: string,
    data: {
      fullName: string;
      countryCode: string;
      documentType: string;
      documentNumber: string;
      phone: string;
      email?: string;
    },
  ) =>
    request<IdentityResponse>(`/guest-conversion/${sessionId}/identity`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  submitPayoutDetails: (sessionId: string, data: { btcAddress: string }) =>
    request<PayoutResponse>(`/guest-conversion/${sessionId}/payout-details`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  initiatePayment: (sessionId: string) =>
    request<PaymentResponse>(`/guest-conversion/${sessionId}/initiate-payment`, {
      method: 'POST',
    }),

  getStatus: (sessionId: string) =>
    request<StatusResponse>(`/guest-conversion/${sessionId}/status`),
};
