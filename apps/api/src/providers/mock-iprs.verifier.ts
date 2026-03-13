import { Injectable } from '@nestjs/common';
import {
  IdentityVerifier,
  IdentityVerifyInput,
  IdentityVerifyResult,
} from './identity-verifier.interface';

@Injectable()
export class MockIprsVerifier implements IdentityVerifier {
  async verify(input: IdentityVerifyInput): Promise<IdentityVerifyResult> {
    // Mock: always verify successfully unless document starts with "FAIL"
    if (input.documentNumber.startsWith('FAIL')) {
      return {
        verified: false,
        matchScore: 0,
        reason: 'Document not found in IPRS records',
      };
    }

    return {
      verified: true,
      matchScore: 95,
    };
  }
}
