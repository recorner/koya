import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  BtcDeliveryProvider,
  BtcSendInput,
  BtcSendResult,
} from './btc-delivery.interface';

@Injectable()
export class MockBtcDeliveryProvider implements BtcDeliveryProvider {
  async send(input: BtcSendInput): Promise<BtcSendResult> {
    // Mock: simulate successful BTC delivery
    const txHash = `mock_${uuidv4().replace(/-/g, '')}`;

    return {
      success: true,
      txHash,
      confirmations: 0,
    };
  }
}
