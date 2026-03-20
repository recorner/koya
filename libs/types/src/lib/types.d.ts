/** Supported currencies in the Koya platform */
export declare enum Currency {
    KES = "KES",
    USD = "USD",
    BTC = "BTC",
    USDC = "USDC",
    USDT = "USDT"
}
/** Standard API response wrapper */
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
    timestamp: string;
}
/** KYC verification tiers */
export declare enum KycTier {
    GUEST = "guest",
    STANDARD = "standard",
    PREMIUM = "premium"
}
/** User account status */
export declare enum AccountStatus {
    ACTIVE = "active",
    SUSPENDED = "suspended",
    FROZEN = "frozen",
    CLOSED = "closed"
}
