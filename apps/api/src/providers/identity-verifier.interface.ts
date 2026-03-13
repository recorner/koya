/** Identity verification (IPRS) abstraction */
export interface IdentityVerifier {
  verify(input: IdentityVerifyInput): Promise<IdentityVerifyResult>;
}

export interface IdentityVerifyInput {
  fullName: string;
  countryCode: string;
  documentType: string;
  documentNumber: string;
}

export interface IdentityVerifyResult {
  verified: boolean;
  matchScore: number;
  reason?: string;
}

export const IDENTITY_VERIFIER = 'IDENTITY_VERIFIER';
