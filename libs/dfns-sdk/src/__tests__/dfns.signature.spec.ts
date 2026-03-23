import { verifyHmacSignature, computeHmacSignature } from '../dfns.signature';
import * as crypto from 'crypto';

describe('dfns.signature', () => {
  const secret = 'test-webhook-secret-key';

  describe('computeHmacSignature', () => {
    it('should compute a valid HMAC-SHA256 signature', () => {
      const payload = '{"test":"data"}';
      const sig = computeHmacSignature(payload, secret);

      const expected = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(sig).toBe(expected);
    });

    it('should handle Buffer input', () => {
      const payload = Buffer.from('{"test":"data"}');
      const sig = computeHmacSignature(payload, secret);
      expect(sig).toHaveLength(64); // SHA-256 hex = 64 chars
    });
  });

  describe('verifyHmacSignature', () => {
    it('should return true for a valid signature', () => {
      const payload = '{"externalId":"abc","status":"COMPLETED"}';
      const sig = computeHmacSignature(payload, secret);
      expect(verifyHmacSignature(payload, sig, secret)).toBe(true);
    });

    it('should return false for a tampered payload', () => {
      const payload = '{"externalId":"abc","status":"COMPLETED"}';
      const sig = computeHmacSignature(payload, secret);
      expect(verifyHmacSignature(payload + 'x', sig, secret)).toBe(false);
    });

    it('should return false for a wrong secret', () => {
      const payload = '{"test":"data"}';
      const sig = computeHmacSignature(payload, secret);
      expect(verifyHmacSignature(payload, sig, 'wrong-secret')).toBe(false);
    });

    it('should return false for empty secret', () => {
      expect(verifyHmacSignature('body', 'sig', '')).toBe(false);
    });

    it('should return false for empty signature', () => {
      expect(verifyHmacSignature('body', '', secret)).toBe(false);
    });

    it('should return false for invalid hex signature', () => {
      expect(verifyHmacSignature('body', 'not-valid-hex!@#', secret)).toBe(false);
    });

    it('should handle Buffer body', () => {
      const payload = Buffer.from('{"test":"data"}');
      const sig = computeHmacSignature(payload, secret);
      expect(verifyHmacSignature(payload, sig, secret)).toBe(true);
    });
  });
});
