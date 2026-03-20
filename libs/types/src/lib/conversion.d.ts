/** Conversion session states */
export declare enum ConversionState {
    INTENT_CAPTURED = "INTENT_CAPTURED",
    QUOTE_PENDING = "QUOTE_PENDING",
    QUOTE_READY = "QUOTE_READY",
    QUOTE_CONFIRMED = "QUOTE_CONFIRMED",
    IDENTITY_PENDING = "IDENTITY_PENDING",
    COMPLIANCE_PENDING = "COMPLIANCE_PENDING",
    PAYOUT_DETAILS_PENDING = "PAYOUT_DETAILS_PENDING",
    PAYMENT_PENDING = "PAYMENT_PENDING",
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED",
    EXECUTION_PENDING = "EXECUTION_PENDING",
    DELIVERY_PENDING = "DELIVERY_PENDING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    EXPIRED = "EXPIRED",
    MANUAL_REVIEW = "MANUAL_REVIEW"
}
/** Conversion channel */
export declare enum Channel {
    WEB = "WEB",
    WHATSAPP = "WHATSAPP"
}
/** Pay-in method */
export declare enum PayinMethod {
    MPESA_STK = "MPESA_STK"
}
/** Payout method */
export declare enum PayoutMethod {
    BTC_ADDRESS = "BTC_ADDRESS"
}
/** Guest identity document types */
export declare enum DocumentType {
    NATIONAL_ID = "NATIONAL_ID",
    PASSPORT = "PASSPORT",
    ALIEN_ID = "ALIEN_ID",
    MILITARY_ID = "MILITARY_ID"
}
/** Guest profile risk level */
export declare enum RiskLevel {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    BLOCKED = "BLOCKED"
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
export declare const VALID_STATE_TRANSITIONS: Record<ConversionState, ConversionState[]>;
