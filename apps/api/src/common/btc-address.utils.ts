import { createHash } from 'crypto';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX = new Map<string, number>(
  [...BASE58_ALPHABET].map((char, idx) => [char, idx]),
);

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_INDEX = new Map<string, number>(
  [...BECH32_CHARSET].map((char, idx) => [char, idx]),
);

const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

const NETWORK_FAMILY = {
  bitcoin: 'mainnet',
  testnet: 'testnet',
  testnet4: 'testnet',
  signet: 'testnet',
  regtest: 'regtest',
} as const;

export type BtcNetwork = keyof typeof NETWORK_FAMILY;
export type BtcAddressNetwork = 'mainnet' | 'testnet' | 'regtest';

export interface BtcAddressValidationResult {
  valid: boolean;
  detectedNetwork?: BtcAddressNetwork;
  reason?: string;
}

function doubleSha256(data: Buffer): Buffer {
  return createHash('sha256').update(createHash('sha256').update(data).digest()).digest();
}

function decodeBase58(address: string): Buffer | null {
  let value = 0n;
  for (const char of address) {
    const index = BASE58_INDEX.get(char);
    if (index === undefined) return null;
    value = value * 58n + BigInt(index);
  }

  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  let decoded = hex === '' ? Buffer.alloc(0) : Buffer.from(hex, 'hex');

  let leadingZeros = 0;
  for (const char of address) {
    if (char !== '1') break;
    leadingZeros += 1;
  }

  if (leadingZeros > 0) {
    decoded = Buffer.concat([Buffer.alloc(leadingZeros), decoded]);
  }

  return decoded;
}

function decodeLegacy(address: string): BtcAddressNetwork | null {
  if (!/^[123mn2][1-9A-HJ-NP-Za-km-z]+$/.test(address)) {
    return null;
  }

  const decoded = decodeBase58(address);
  if (!decoded || decoded.length !== 25) {
    return null;
  }

  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  const expected = doubleSha256(payload).subarray(0, 4);
  if (!checksum.equals(expected)) {
    return null;
  }

  const version = payload[0];
  if (version === 0x00 || version === 0x05) return 'mainnet';
  if (version === 0x6f || version === 0xc4) return 'testnet';
  return null;
}

function bech32Polymod(values: number[]): number {
  const generators = [
    0x3b6a57b2,
    0x26508e6d,
    0x1ea119fa,
    0x3d4233dd,
    0x2a1462b3,
  ];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) {
      if ((top >> i) & 1) chk ^= generators[i]!;
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let i = 0; i < hrp.length; i += 1) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i += 1) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] | null {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) return null;
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) ret.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
    return null;
  }

  return ret;
}

function decodeSegwit(address: string): BtcAddressNetwork | null {
  if (address.length < 14 || address.length > 90) return null;

  const hasLower = address !== address.toUpperCase();
  const hasUpper = address !== address.toLowerCase();
  if (hasLower && hasUpper) return null;

  const normalized = address.toLowerCase();
  const separator = normalized.lastIndexOf('1');
  if (separator < 1 || separator + 7 > normalized.length) return null;

  const hrp = normalized.slice(0, separator);
  if (hrp !== 'bc' && hrp !== 'tb' && hrp !== 'bcrt') return null;

  const data: number[] = [];
  for (const char of normalized.slice(separator + 1)) {
    const index = BECH32_INDEX.get(char);
    if (index === undefined) return null;
    data.push(index);
  }

  const checksum = bech32Polymod([...bech32HrpExpand(hrp), ...data]);
  const encoding = checksum === BECH32_CONST ? 'bech32' : checksum === BECH32M_CONST ? 'bech32m' : null;
  if (!encoding) return null;

  const payload = data.slice(0, -6);
  if (payload.length === 0) return null;

  const witnessVersion = payload[0];
  if (witnessVersion === undefined) return null;
  if (witnessVersion < 0 || witnessVersion > 16) return null;

  const program = convertBits(payload.slice(1), 5, 8, false);
  if (!program || program.length < 2 || program.length > 40) return null;

  if (witnessVersion === 0) {
    if (encoding !== 'bech32') return null;
    if (program.length !== 20 && program.length !== 32) return null;
  } else if (encoding !== 'bech32m') {
    return null;
  }

  if (hrp === 'bc') return 'mainnet';
  if (hrp === 'tb') return 'testnet';
  return 'regtest';
}

export function detectBtcAddressNetwork(address: string): BtcAddressNetwork | null {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const segwitNetwork = decodeSegwit(trimmed);
  if (segwitNetwork) return segwitNetwork;

  return decodeLegacy(trimmed);
}

export function normalizeBtcNetwork(network: string | undefined): BtcNetwork {
  const normalized = (network ?? '').toLowerCase().trim();
  if (normalized in NETWORK_FAMILY) {
    return normalized as BtcNetwork;
  }
  return 'bitcoin';
}

export function validateBtcAddressForNetwork(
  address: string,
  configuredNetwork: string | undefined,
): BtcAddressValidationResult {
  const detectedNetwork = detectBtcAddressNetwork(address);
  if (!detectedNetwork) {
    return { valid: false, reason: 'invalid_format' };
  }

  const normalizedTarget = normalizeBtcNetwork(configuredNetwork);
  const expectedFamily = NETWORK_FAMILY[normalizedTarget];

  if (expectedFamily === 'mainnet' && detectedNetwork !== 'mainnet') {
    return { valid: false, detectedNetwork, reason: 'network_mismatch' };
  }

  if (expectedFamily === 'testnet' && detectedNetwork !== 'testnet') {
    return { valid: false, detectedNetwork, reason: 'network_mismatch' };
  }

  if (expectedFamily === 'regtest' && detectedNetwork !== 'regtest') {
    return { valid: false, detectedNetwork, reason: 'network_mismatch' };
  }

  return { valid: true, detectedNetwork };
}

export function isValidBtcAddress(address: string): boolean {
  return detectBtcAddressNetwork(address) !== null;
}
