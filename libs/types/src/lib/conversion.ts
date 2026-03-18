/** Conversion session states */
export enum ConversionState {
  INTENT_CAPTURED = 'INTENT_CAPTURED',
  QUOTE_PENDING = 'QUOTE_PENDING',
  QUOTE_READY = 'QUOTE_READY',
  QUOTE_CONFIRMED = 'QUOTE_CONFIRMED',
  IDENTITY_PENDING = 'IDENTITY_PENDING',
  COMPLIANCE_PENDING = 'COMPLIANCE_PENDING',
  PAYOUT_DETAILS_PENDING = 'PAYOUT_DETAILS_PENDING',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  EXECUTION_PENDING = 'EXECUTION_PENDING',
  DELIVERY_PENDING = 'DELIVERY_PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}

/** Conversion channel */
export enum Channel {
  WEB = 'WEB',
  WHATSAPP = 'WHATSAPP',
}

/** Pay-in method */
export enum PayinMethod {
  MPESA_STK = 'MPESA_STK',
}

/** Payout method */
export enum PayoutMethod {
  BTC_ADDRESS = 'BTC_ADDRESS',
}

/** Guest identity document types */
export enum DocumentType {
  NATIONAL_ID = 'NATIONAL_ID',
  PASSPORT = 'PASSPORT',
  ALIEN_ID = 'ALIEN_ID',
  MILITARY_ID = 'MILITARY_ID',
}

/** Guest profile risk level */
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  BLOCKED = 'BLOCKED',
}

/** Conversion quote response */
export interface ConversionQuoteResponse {
  quoteId: string;
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
  targetAmount: string;
  rate: string;
  fee: string;
  spread: string;
  expiresAt: string;
}

/** Conversion session status response (safe for UI) */
export interface ConversionSessionStatus {
  sessionId: string;
  currentState: ConversionState;
  referenceCode: string;
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
  targetAmount: string | null;
  guestRef: string | null;
  createdAt: string;
}

/** Quote request input */
export interface QuoteRequestInput {
  sourceAsset: string;
  targetAsset: string;
  sourceAmount: string;
  channel: Channel;
}

/** Identity submission input */
export interface IdentitySubmissionInput {
  fullName: string;
  countryCode: string;
  documentType: DocumentType;
  documentNumber: string;
  phone: string;
  email?: string;
}

/** Payout details input */
export interface PayoutDetailsInput {
  btcAddress: string;
}

/** Compliance result */
export interface ComplianceResult {
  passed: boolean;
  iprsVerified: boolean;
  amlCleared: boolean;
  riskLevel: RiskLevel;
  reason?: string;
}

/** Valid state transitions map */
export const VALID_STATE_TRANSITIONS: Record<ConversionState, ConversionState[]> = {
  [ConversionState.INTENT_CAPTURED]: [ConversionState.QUOTE_PENDING, ConversionState.FAILED, ConversionState.EXPIRED],
  [ConversionState.QUOTE_PENDING]: [ConversionState.QUOTE_READY, ConversionState.FAILED, ConversionState.EXPIRED],
  [ConversionState.QUOTE_READY]: [ConversionState.QUOTE_CONFIRMED, ConversionState.EXPIRED, ConversionState.FAILED],
  [ConversionState.QUOTE_CONFIRMED]: [ConversionState.IDENTITY_PENDING, ConversionState.FAILED, ConversionState.EXPIRED],
  [ConversionState.IDENTITY_PENDING]: [ConversionState.COMPLIANCE_PENDING, ConversionState.FAILED, ConversionState.EXPIRED],
  [ConversionState.COMPLIANCE_PENDING]: [ConversionState.PAYOUT_DETAILS_PENDING, ConversionState.FAILED, ConversionState.MANUAL_REVIEW, ConversionState.EXPIRED],
  [ConversionState.PAYOUT_DETAILS_PENDING]: [ConversionState.PAYMENT_PENDING, ConversionState.FAILED, ConversionState.EXPIRED],
  [ConversionState.PAYMENT_PENDING]: [ConversionState.PAYMENT_CONFIRMED, ConversionState.FAILED, ConversionState.EXPIRED],
  [ConversionState.PAYMENT_CONFIRMED]: [ConversionState.EXECUTION_PENDING, ConversionState.FAILED],
  [ConversionState.EXECUTION_PENDING]: [ConversionState.DELIVERY_PENDING, ConversionState.FAILED],
  [ConversionState.DELIVERY_PENDING]: [ConversionState.COMPLETED, ConversionState.FAILED],
  [ConversionState.COMPLETED]: [],
  [ConversionState.FAILED]: [],
  [ConversionState.EXPIRED]: [],
  [ConversionState.MANUAL_REVIEW]: [ConversionState.COMPLIANCE_PENDING, ConversionState.FAILED],
};
