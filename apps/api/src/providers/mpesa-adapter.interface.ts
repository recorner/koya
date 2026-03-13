/** M-Pesa STK push abstraction */
export interface MpesaAdapter {
  initiateSTKPush(input: STKPushInput): Promise<STKPushResult>;
}

export interface STKPushInput {
  phoneE164: string;
  amountKES: number;
  accountReference: string;
  transactionDesc: string;
}

export interface STKPushResult {
  success: boolean;
  merchantRequestId: string;
  checkoutRequestId: string;
  responseDescription: string;
}

/** Callback payload from M-Pesa */
export interface MpesaCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value: string | number }>;
      };
    };
  };
}

export const MPESA_ADAPTER = 'MPESA_ADAPTER';
