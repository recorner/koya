import {
  detectBtcAddressNetwork,
  validateBtcAddressForNetwork,
} from '../btc-address.utils';

describe('btc-address.utils', () => {
  it('detects mainnet legacy addresses', () => {
    expect(detectBtcAddressNetwork('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('mainnet');
  });

  it('detects testnet legacy addresses', () => {
    expect(detectBtcAddressNetwork('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn')).toBe('testnet');
  });

  it('rejects invalid checksum', () => {
    expect(detectBtcAddressNetwork('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb')).toBeNull();
  });

  it('accepts testnet family for testnet4 config', () => {
    const result = validateBtcAddressForNetwork(
      'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      'testnet4',
    );
    expect(result.valid).toBe(true);
    expect(result.detectedNetwork).toBe('testnet');
  });

  it('rejects mainnet address for testnet4 config', () => {
    const result = validateBtcAddressForNetwork(
      'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      'testnet4',
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('network_mismatch');
    expect(result.detectedNetwork).toBe('mainnet');
  });
});
