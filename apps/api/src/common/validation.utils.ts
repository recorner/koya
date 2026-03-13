/**
 * Normalize a Kenya phone number to E.164 format (+254XXXXXXXXX)
 * Handles: 07XX, +2547XX, 2547XX, 01XX formats
 */
export function normalizeKenyaPhone(phone: string): string {
  const digits = phone.replace(/[\s\-()]/g, '');

  if (/^\+254\d{9}$/.test(digits)) return digits;
  if (/^254\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0[17]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `+254${digits}`;

  throw new Error(`Invalid Kenya phone number: ${phone}`);
}

/**
 * Validate a BTC address (P2PKH, P2SH, Bech32, Taproot)
 */
export function isValidBtcAddress(address: string): boolean {
  // P2PKH: starts with 1, 25-34 chars
  if (/^1[a-km-zA-HJ-NP-Z1-9]{24,33}$/.test(address)) return true;
  // P2SH: starts with 3, 25-34 chars
  if (/^3[a-km-zA-HJ-NP-Z1-9]{24,33}$/.test(address)) return true;
  // Bech32: starts with bc1q, 42 or 62 chars
  if (/^bc1q[a-z0-9]{38,58}$/.test(address)) return true;
  // Taproot: starts with bc1p, 62 chars
  if (/^bc1p[a-z0-9]{58}$/.test(address)) return true;

  return false;
}

/**
 * Normalize a document number (uppercase, strip spaces/dashes)
 */
export function normalizeDocumentNumber(docNumber: string): string {
  return docNumber.toUpperCase().replace(/[\s\-]/g, '');
}

/**
 * Generate a 12-digit numeric guest reference
 */
export function generateGuestRef(): string {
  const min = 100_000_000_000;
  const max = 999_999_999_999;
  const ref = Math.floor(min + Math.random() * (max - min + 1));
  return ref.toString();
}

/**
 * Validate KES amount (in minor units = cents)
 * Min: 100 KES (10000 cents), Max: 100,000 KES (10,000,000 cents) for guest
 */
export function validateKesAmount(amountMinor: bigint): {
  valid: boolean;
  reason?: string;
} {
  const MIN_AMOUNT = BigInt(10_000);       // 100 KES
  const MAX_GUEST_AMOUNT = BigInt(10_000_000_000); // 100,000 KES

  if (amountMinor < MIN_AMOUNT) {
    return { valid: false, reason: 'Minimum amount is KES 100' };
  }
  if (amountMinor > MAX_GUEST_AMOUNT) {
    return { valid: false, reason: 'Maximum guest amount is KES 100,000' };
  }
  return { valid: true };
}

/**
 * Parse a human-readable amount string to minor units (BigInt cents)
 * e.g., "1000" or "1,000.50" → BigInt(100050)
 */
export function parseAmountToMinor(amount: string, decimals: number): bigint {
  const cleaned = amount.replace(/,/g, '');
  const parts = cleaned.split('.');
  const integerPart = parts[0] ?? '0';
  let fractionalPart = parts[1] ?? '';

  // Pad or truncate fractional part to match decimal places
  fractionalPart = fractionalPart.padEnd(decimals, '0').slice(0, decimals);

  return BigInt(`${integerPart}${fractionalPart}`);
}

/**
 * Format minor units to human-readable string
 */
export function formatMinorToDisplay(
  amountMinor: bigint,
  decimals: number,
): string {
  const str = amountMinor.toString().padStart(decimals + 1, '0');
  const integerPart = str.slice(0, str.length - decimals) || '0';
  const fractionalPart = str.slice(str.length - decimals);
  return decimals > 0 ? `${integerPart}.${fractionalPart}` : integerPart;
}
