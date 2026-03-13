import {
  normalizeKenyaPhone,
  isValidBtcAddress,
  normalizeDocumentNumber,
  generateGuestRef,
  validateKesAmount,
  parseAmountToMinor,
  formatMinorToDisplay,
} from '../common/validation.utils';

describe('normalizeKenyaPhone', () => {
  it('handles +254 format', () => {
    expect(normalizeKenyaPhone('+254712345678')).toBe('+254712345678');
  });

  it('handles 254 without plus', () => {
    expect(normalizeKenyaPhone('254712345678')).toBe('+254712345678');
  });

  it('handles 07XX format', () => {
    expect(normalizeKenyaPhone('0712345678')).toBe('+254712345678');
  });

  it('handles 7XX format', () => {
    expect(normalizeKenyaPhone('712345678')).toBe('+254712345678');
  });

  it('handles 01XX format', () => {
    expect(normalizeKenyaPhone('0112345678')).toBe('+254112345678');
  });

  it('strips spaces and dashes', () => {
    expect(normalizeKenyaPhone('0712-345-678')).toBe('+254712345678');
    expect(normalizeKenyaPhone('0712 345 678')).toBe('+254712345678');
  });

  it('throws on invalid number', () => {
    expect(() => normalizeKenyaPhone('123')).toThrow();
    expect(() => normalizeKenyaPhone('abc')).toThrow();
  });
});

describe('isValidBtcAddress', () => {
  it('accepts P2PKH (starts with 1)', () => {
    expect(isValidBtcAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true);
  });

  it('accepts P2SH (starts with 3)', () => {
    expect(isValidBtcAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true);
  });

  it('accepts Bech32 (starts with bc1q)', () => {
    expect(
      isValidBtcAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'),
    ).toBe(true);
  });

  it('rejects invalid addresses', () => {
    expect(isValidBtcAddress('invalid')).toBe(false);
    expect(isValidBtcAddress('')).toBe(false);
    expect(isValidBtcAddress('0x1234')).toBe(false);
  });
});

describe('normalizeDocumentNumber', () => {
  it('uppercases and strips spaces/dashes', () => {
    expect(normalizeDocumentNumber('abc-123 def')).toBe('ABC123DEF');
  });
});

describe('generateGuestRef', () => {
  it('returns a 12-digit numeric string', () => {
    const ref = generateGuestRef();
    expect(ref).toMatch(/^\d{12}$/);
  });

  it('generates unique values', () => {
    const refs = new Set(Array.from({ length: 100 }, () => generateGuestRef()));
    expect(refs.size).toBeGreaterThan(90); // Allow some collisions in random
  });
});

describe('validateKesAmount', () => {
  it('accepts valid amounts', () => {
    expect(validateKesAmount(BigInt(10_000))).toEqual({ valid: true });
    expect(validateKesAmount(BigInt(1_000_000))).toEqual({ valid: true });
  });

  it('rejects amounts below minimum', () => {
    const result = validateKesAmount(BigInt(5_000));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Minimum');
  });

  it('rejects amounts above maximum', () => {
    const result = validateKesAmount(BigInt(20_000_000_000));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Maximum');
  });
});

describe('parseAmountToMinor', () => {
  it('parses integer KES amount', () => {
    expect(parseAmountToMinor('1000', 2)).toBe(BigInt(100000));
  });

  it('parses decimal KES amount', () => {
    expect(parseAmountToMinor('1000.50', 2)).toBe(BigInt(100050));
  });

  it('parses BTC amount with 8 decimals', () => {
    expect(parseAmountToMinor('0.00100000', 8)).toBe(BigInt(100000));
  });

  it('handles comma-separated amounts', () => {
    expect(parseAmountToMinor('1,000', 2)).toBe(BigInt(100000));
  });
});

describe('formatMinorToDisplay', () => {
  it('formats KES minor units', () => {
    expect(formatMinorToDisplay(BigInt(100050), 2)).toBe('1000.50');
  });

  it('formats BTC satoshis', () => {
    expect(formatMinorToDisplay(BigInt(100000), 8)).toBe('0.00100000');
  });

  it('handles zero', () => {
    expect(formatMinorToDisplay(BigInt(0), 2)).toBe('0.00');
  });
});
