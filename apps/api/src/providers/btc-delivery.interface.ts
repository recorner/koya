/** BTC delivery abstraction */
export interface BtcDeliveryProvider {
  send(input: BtcSendInput): Promise<BtcSendResult>;
}

export interface BtcSendInput {
  address: string;
  amountSatoshis: bigint;
  referenceCode: string;
}

export interface BtcSendResult {
  success: boolean;
  txHash: string;
  confirmations: number;
}

export const BTC_DELIVERY_PROVIDER = 'BTC_DELIVERY_PROVIDER';
