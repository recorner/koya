import { Injectable } from '@nestjs/common';
import { AmlScreener, AmlScreenInput, AmlScreenResult } from './aml-screener.interface';

@Injectable()
export class MockAmlScreener implements AmlScreener {
  async screen(input: AmlScreenInput): Promise<AmlScreenResult> {
    // Mock: flag documents starting with "BLOCK" as blocked
    if (input.documentNumber.startsWith('BLOCK')) {
      return {
        cleared: false,
        riskLevel: 'BLOCKED',
        hitCount: 3,
        reason: 'Sanctions list match (mock)',
      };
    }

    // Mock: flag documents starting with "RISK" as high risk
    if (input.documentNumber.startsWith('RISK')) {
      return {
        cleared: false,
        riskLevel: 'HIGH',
        hitCount: 1,
        reason: 'PEP match (mock)',
      };
    }

    return {
      cleared: true,
      riskLevel: 'LOW',
      hitCount: 0,
    };
  }
}
