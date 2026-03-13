import { Injectable } from '@nestjs/common';
import { RateProvider, RateResult } from './rate-provider.interface';

const MOCK_RATES: Record<string, Record<string, string>> = {
  KES: {
    BTC: '0.0000000881',
    USD: '0.0077',
    USDC: '0.0077',
    USDT: '0.0077',
  },
  BTC: {
    KES: '11352978',
    USD: '87432.10',
    USDC: '87432.10',
    USDT: '87432.10',
  },
};

const SPREADS: Record<string, string> = {
  'KES_BTC': '0.015',  // 1.5% spread
  'BTC_KES': '0.015',
};

@Injectable()
export class MockRateProvider implements RateProvider {
  async getRate(sourceAsset: string, targetAsset: string): Promise<RateResult> {
    const rate = MOCK_RATES[sourceAsset]?.[targetAsset];
    if (!rate) {
      throw new Error(`No rate available for ${sourceAsset} → ${targetAsset}`);
    }

    const spreadKey = `${sourceAsset}_${targetAsset}`;
    const spread = SPREADS[spreadKey] ?? '0.01';

    return {
      rate,
      spread,
      timestamp: new Date(),
    };
  }
}
