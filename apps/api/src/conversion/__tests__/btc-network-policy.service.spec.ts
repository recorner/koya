import {
  expectedBriaRuntimeFromPolicy,
  normalizeBriaRuntimeNetwork,
} from '../btc-network-policy.service';

describe('btc-network policy mapping', () => {
  it('maps policy testnet4 to Bria runtime testnet', () => {
    expect(expectedBriaRuntimeFromPolicy('testnet4')).toBe('testnet');
  });

  it('maps policy mainnet to Bria runtime bitcoin', () => {
    expect(expectedBriaRuntimeFromPolicy('bitcoin')).toBe('bitcoin');
    expect(expectedBriaRuntimeFromPolicy('mainnet')).toBe('bitcoin');
  });

  it('normalizes Bria runtime aliases', () => {
    expect(normalizeBriaRuntimeNetwork('testnet4')).toBe('testnet');
    expect(normalizeBriaRuntimeNetwork('mainnet')).toBe('bitcoin');
    expect(normalizeBriaRuntimeNetwork('bitcoin')).toBe('bitcoin');
  });

  it('defaults unknown Bria network to regtest', () => {
    expect(normalizeBriaRuntimeNetwork('unknown-network')).toBe('regtest');
  });
});
