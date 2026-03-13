import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  MpesaAdapter,
  STKPushInput,
  STKPushResult,
} from './mpesa-adapter.interface';

@Injectable()
export class MockMpesaAdapter implements MpesaAdapter {
  async initiateSTKPush(input: STKPushInput): Promise<STKPushResult> {
    // Mock: simulate successful STK push initiation
    const merchantRequestId = `MOCK-MR-${uuidv4().slice(0, 8).toUpperCase()}`;
    const checkoutRequestId = `MOCK-CR-${uuidv4().slice(0, 8).toUpperCase()}`;

    return {
      success: true,
      merchantRequestId,
      checkoutRequestId,
      responseDescription: `Mock STK push sent to ${input.phoneE164} for KES ${input.amountKES}`,
    };
  }
}
