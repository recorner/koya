/** AML screening abstraction */
export interface AmlScreener {
  screen(input: AmlScreenInput): Promise<AmlScreenResult>;
}

export interface AmlScreenInput {
  fullName: string;
  countryCode: string;
  documentType: string;
  documentNumber: string;
}

export interface AmlScreenResult {
  cleared: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  hitCount: number;
  reason?: string;
}

export const AML_SCREENER = 'AML_SCREENER';
