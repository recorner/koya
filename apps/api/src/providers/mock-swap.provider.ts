import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  SwapProvider,
  SwapInput,
  SwapResult,
} from './swap-provider.interface';

@Injectable()
export class MockSwapProvider implements SwapProvider {
  private readonly logger = new Logger(MockSwapProvider.name);

  async executeSwap(input: SwapInput): Promise<SwapResult> {
    this.logger.log(
      `Mock swap: ${input.sourceAsset} → ${input.targetAsset} ` +
        `amount=${input.sourceAmountMinor} rate=${input.rate} ref=${input.referenceCode}`,
    );

    // Simulate a small random slippage (0.0–0.3%)
    const slippage = 1 - Math.random() * 0.003;
    const rateNum = parseFloat(input.rate);
    const settledRate = (rateNum * slippage).toPrecision(10);

    // Calculate target amount using the settled rate
    // sourceAmountMinor * settledRate (accounting for decimal shift)
    const sourceNum = Number(input.sourceAmountMinor);
    const rawTarget = sourceNum * parseFloat(settledRate);
    const targetAmountMinor = BigInt(Math.floor(rawTarget));

    return {
      success: true,
      targetAmountMinor,
      executionId: `MOCK-SWAP-${uuidv4().slice(0, 12).toUpperCase()}`,
      settledRate,
      executedAt: new Date(),
    };
  }
}
