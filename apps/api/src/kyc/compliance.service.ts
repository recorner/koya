import { Injectable, Inject } from '@nestjs/common';
import { IDENTITY_VERIFIER } from '../providers/identity-verifier.interface';
import { AML_SCREENER } from '../providers/aml-screener.interface';
import type { IdentityVerifier } from '../providers/identity-verifier.interface';
import type { AmlScreener } from '../providers/aml-screener.interface';
import { ComplianceResult, RiskLevel } from '@koya/types';

@Injectable()
export class ComplianceService {
  constructor(
    @Inject(IDENTITY_VERIFIER) private readonly identityVerifier: IdentityVerifier,
    @Inject(AML_SCREENER) private readonly amlScreener: AmlScreener,
  ) {}

  async runChecks(input: {
    fullName: string;
    countryCode: string;
    documentType: string;
    documentNumber: string;
  }): Promise<ComplianceResult> {
    const [iprsResult, amlResult] = await Promise.all([
      this.identityVerifier.verify(input),
      this.amlScreener.screen(input),
    ]);

    if (!iprsResult.verified) {
      return {
        passed: false,
        iprsVerified: false,
        amlCleared: false,
        riskLevel: RiskLevel.HIGH,
        reason: iprsResult.reason ?? 'Identity verification failed',
      };
    }

    if (!amlResult.cleared) {
      return {
        passed: false,
        iprsVerified: true,
        amlCleared: false,
        riskLevel: amlResult.riskLevel as RiskLevel,
        reason: amlResult.reason ?? 'AML screening failed',
      };
    }

    return {
      passed: true,
      iprsVerified: true,
      amlCleared: true,
      riskLevel: amlResult.riskLevel as RiskLevel,
    };
  }
}
