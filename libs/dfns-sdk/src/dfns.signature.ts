/** HMAC-SHA256 signature verification utilities */

import * as crypto from 'crypto';

/**
 * Verify an HMAC-SHA256 webhook signature using constant-time comparison.
 *
 * @param rawBody - Raw request body (string or Buffer)
 * @param signatureHex - Hex-encoded HMAC signature from header
 * @param secret - HMAC secret key
 * @returns true if the signature is valid
 */
export function verifyHmacSignature(
  rawBody: Buffer | string,
  signatureHex: string,
  secret: string,
): boolean {
  if (!secret || !signatureHex) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHex, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    // Length mismatch or invalid hex
    return false;
  }
}

/**
 * Compute an HMAC-SHA256 signature for a payload.
 *
 * @param payload - Payload to sign (string or Buffer)
 * @param secret - HMAC secret key
 * @returns Hex-encoded HMAC signature
 */
export function computeHmacSignature(
  payload: Buffer | string,
  secret: string,
): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}
