import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import { firstValueFrom, take, toArray } from 'rxjs';
import { EventEmitter } from 'events';

import { BriaClientService } from '../bria-client.service';
import { BriaClientError, BriaErrorCode } from '../bria.errors';

// ─── Mock gRPC layer ──────────────────────────────────────

function createMockClient() {
  return {
    close: jest.fn(),
    createProfile: jest.fn(),
    createProfileApiKey: jest.fn(),
    importXpub: jest.fn(),
    createWallet: jest.fn(),
    getWalletBalanceSummary: jest.fn(),
    newAddress: jest.fn(),
    submitPayout: jest.fn(),
    estimatePayoutFee: jest.fn(),
    getPayout: jest.fn(),
    cancelPayout: jest.fn(),
    submitSignedPsbt: jest.fn(),
    subscribeAll: jest.fn(),
  };
}

type MockClient = ReturnType<typeof createMockClient>;

// Patch proto loading to inject our mock
jest.mock('@grpc/proto-loader', () => ({
  load: jest.fn().mockResolvedValue({}),
}));

jest.mock('@grpc/grpc-js', () => {
  const actualGrpc = jest.requireActual('@grpc/grpc-js') as typeof grpc;
  return {
    ...actualGrpc,
    loadPackageDefinition: jest.fn().mockReturnValue({
      services: {
        bria: {
          v1: {
            BriaService: class MockBriaService {
              // mock client gets assigned in beforeEach
            },
          },
        },
      },
    }),
    credentials: {
      createInsecure: jest.fn().mockReturnValue({}),
    },
    Metadata: actualGrpc.Metadata,
    status: actualGrpc.status,
  };
});

describe('BriaClientService', () => {
  let service: BriaClientService;
  let mockClient: MockClient;

  beforeEach(async () => {
    mockClient = createMockClient();

    // Arrange: make loadPackageDefinition return our mock constructor
    (grpc.loadPackageDefinition as jest.Mock).mockReturnValue({
      services: {
        bria: {
          v1: {
            BriaService: function MockBriaService() {
              return mockClient;
            },
          },
        },
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              BRIA_API_HOST: 'localhost',
              BRIA_API_PORT: 2742,
              BRIA_API_KEY: 'test-api-key',
            }),
          ],
        }),
      ],
      providers: [BriaClientService],
    })
      .setLogger({ log() {}, error() {}, warn() {}, debug() {}, verbose() {}, fatal() {} })
      .compile();

    service = module.get(BriaClientService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  // ─── createProfile ───────────────────────────────────────

  describe('createProfile', () => {
    it('returns profile id on success', async () => {
      mockClient.createProfile.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => cb(null, { id: 'prof-1' }),
      );
      const result = await service.createProfile({ name: 'koya-main' });
      expect(result).toEqual({ id: 'prof-1' });
    });

    it('passes spending policy when provided', async () => {
      mockClient.createProfile.mockImplementation(
        (req: Record<string, unknown>, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => {
          expect(req['spendingPolicy']).toBeDefined();
          cb(null, { id: 'prof-2' });
        },
      );
      await service.createProfile({
        name: 'restricted',
        spendingPolicy: { maxPayoutSats: 100000 },
      });
    });

    it('maps gRPC errors to BriaClientError', async () => {
      mockClient.createProfile.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) =>
          cb({ code: grpc.status.ALREADY_EXISTS, details: 'Profile already exists' }),
      );
      await expect(service.createProfile({ name: 'dup' })).rejects.toThrow(BriaClientError);
      await expect(service.createProfile({ name: 'dup' })).rejects.toMatchObject({
        code: BriaErrorCode.ALREADY_EXISTS,
      });
    });
  });

  // ─── createProfileApiKey ─────────────────────────────────

  describe('createProfileApiKey', () => {
    it('returns key on success', async () => {
      mockClient.createProfileApiKey.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) =>
          cb(null, { id: 'key-1', key: 'bria_key_abc123' }),
      );
      const result = await service.createProfileApiKey('koya-main');
      expect(result).toEqual({ id: 'key-1', key: 'bria_key_abc123' });
    });
  });

  // ─── importXpub ──────────────────────────────────────────

  describe('importXpub', () => {
    it('returns xpub id on success', async () => {
      mockClient.importXpub.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => cb(null, { id: 'xpub-1' }),
      );
      const result = await service.importXpub({
        name: 'main-xpub',
        xpub: 'tpub123...',
        derivation: "m/84'/0'/0'",
      });
      expect(result).toEqual({ id: 'xpub-1' });
    });
  });

  // ─── createWallet ────────────────────────────────────────

  describe('createWallet', () => {
    it('returns wallet id and xpub ids', async () => {
      mockClient.createWallet.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) =>
          cb(null, { id: 'wallet-1', xpubIds: ['xpub-1'] }),
      );
      const result = await service.createWallet({
        name: 'koya-hot',
        keychainConfig: {
          wpkh: { xpub: 'tpub123...', derivationPath: "m/84'/0'/0'" },
        },
      });
      expect(result).toEqual({ id: 'wallet-1', xpubIds: ['xpub-1'] });
    });

    it('throws on invalid keychain config', async () => {
      await expect(
        service.createWallet({ name: 'bad', keychainConfig: {} }),
      ).rejects.toThrow('Invalid keychain config');
    });
  });

  // ─── getWalletBalance ────────────────────────────────────

  describe('getWalletBalance', () => {
    it('returns balance summary', async () => {
      const balance = {
        effectivePendingIncome: 0,
        effectiveSettled: 5000000,
        effectivePendingOutgoing: 100000,
        effectiveEncumberedOutgoing: 0,
        utxoEncumberedIncoming: 0,
        utxoPendingIncoming: 0,
        utxoSettled: 5000000,
        utxoPendingOutgoing: 100000,
        feesPending: 1000,
        feesEncumbered: 0,
      };
      mockClient.getWalletBalanceSummary.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => cb(null, balance),
      );
      const result = await service.getWalletBalance('koya-hot');
      expect(result.effectiveSettled).toBe(5000000);
    });
  });

  // ─── newAddress ──────────────────────────────────────────

  describe('newAddress', () => {
    it('returns address', async () => {
      mockClient.newAddress.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) =>
          cb(null, { address: 'tb1q_test_address_123' }),
      );
      const result = await service.newAddress({
        walletName: 'koya-hot',
        externalId: 'session-abc',
      });
      expect(result.address).toBe('tb1q_test_address_123');
    });
  });

  // ─── submitPayout ────────────────────────────────────────

  describe('submitPayout', () => {
    it('returns payout id on success', async () => {
      mockClient.submitPayout.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) =>
          cb(null, { id: 'payout-1', batchInclusionEstimatedAt: 1714000000 }),
      );
      const result = await service.submitPayout({
        walletName: 'koya-hot',
        payoutQueueName: 'default',
        destination: { onchainAddress: 'tb1q_dest_123' },
        satoshis: 50000,
        externalId: 'session-abc',
      });
      expect(result.id).toBe('payout-1');
    });

    it('handles destination wallet name', async () => {
      mockClient.submitPayout.mockImplementation(
        (req: Record<string, unknown>, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => {
          expect(req['destinationWalletName']).toBe('cold-storage');
          cb(null, { id: 'payout-2' });
        },
      );
      await service.submitPayout({
        walletName: 'koya-hot',
        payoutQueueName: 'default',
        destination: { destinationWalletName: 'cold-storage' },
        satoshis: 100000,
      });
    });
  });

  // ─── estimatePayoutFee ───────────────────────────────────

  describe('estimatePayoutFee', () => {
    it('returns fee estimate', async () => {
      mockClient.estimatePayoutFee.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => cb(null, { satoshis: 1500 }),
      );
      const result = await service.estimatePayoutFee({
        walletName: 'koya-hot',
        payoutQueueName: 'default',
        destination: { onchainAddress: 'tb1q_dest_123' },
        satoshis: 50000,
      });
      expect(result.satoshis).toBe(1500);
    });
  });

  // ─── getPayout ───────────────────────────────────────────

  describe('getPayout', () => {
    it('returns payout info by id', async () => {
      const payout = {
        id: 'payout-1',
        walletId: 'wallet-1',
        payoutQueueId: 'queue-1',
        satoshis: 50000,
        cancelled: false,
        externalId: 'session-abc',
      };
      mockClient.getPayout.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) =>
          cb(null, { payout }),
      );
      const result = await service.getPayout({ id: 'payout-1' });
      expect(result.externalId).toBe('session-abc');
    });

    it('supports lookup by externalId', async () => {
      mockClient.getPayout.mockImplementation(
        (req: Record<string, unknown>, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => {
          expect(req['externalId']).toBe('session-abc');
          cb(null, {
            payout: { id: 'payout-1', externalId: 'session-abc', cancelled: false, satoshis: 50000 },
          });
        },
      );
      await service.getPayout({ externalId: 'session-abc' });
    });
  });

  // ─── cancelPayout ────────────────────────────────────────

  describe('cancelPayout', () => {
    it('succeeds with no return value', async () => {
      mockClient.cancelPayout.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => cb(null, {}),
      );
      await expect(service.cancelPayout('payout-1')).resolves.toBeUndefined();
    });
  });

  // ─── submitSignedPsbt ────────────────────────────────────

  describe('submitSignedPsbt', () => {
    it('succeeds', async () => {
      mockClient.submitSignedPsbt.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => cb(null, {}),
      );
      await expect(
        service.submitSignedPsbt({
          batchId: 'batch-1',
          xpubRef: 'main-xpub',
          signedPsbt: 'cHNidD0...',
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── subscribeAll ────────────────────────────────────────

  function createMockStream() {
    const stream = new EventEmitter() as EventEmitter & { cancel: jest.Mock };
    stream.cancel = jest.fn();
    return stream;
  }

  describe('subscribeAll', () => {
    it('emits parsed events', async () => {
      const mockStream = createMockStream();
      mockClient.subscribeAll.mockReturnValue(mockStream);

      const events$ = service.subscribeAll({ afterSequence: 0 });
      const eventsPromise = firstValueFrom(events$.pipe(take(2), toArray()));

      // Simulate server pushing events
      mockStream.emit('data', {
        sequence: 1,
        recordedAt: 1714000000,
        utxoDetected: {
          walletId: 'w-1',
          txId: 'tx-abc',
          vout: 0,
          satoshis: 50000,
          address: 'tb1q_addr',
        },
      });
      mockStream.emit('data', {
        sequence: 2,
        recordedAt: 1714000010,
        payoutSubmitted: {
          id: 'p-1',
          walletId: 'w-1',
          payoutQueueId: 'q-1',
          satoshis: 25000,
          onchainAddress: 'tb1q_dest',
        },
      });

      const events = await eventsPromise;
      expect(events).toHaveLength(2);
      expect(events[0]!.payload.type).toBe('utxo_detected');
      expect(events[1]!.payload.type).toBe('payout_submitted');
      expect(events[0]!.sequence).toBe(1);
    });

    it('errors are mapped to BriaClientError', async () => {
      const mockStream = createMockStream();
      mockClient.subscribeAll.mockReturnValue(mockStream);

      const events$ = service.subscribeAll();
      const errorPromise = firstValueFrom(events$).catch((err) => err);

      mockStream.emit('error', {
        code: grpc.status.UNAVAILABLE,
        details: 'Connection lost',
      });

      const err = await errorPromise;
      expect(err).toBeInstanceOf(BriaClientError);
      expect(err.code).toBe(BriaErrorCode.UNAVAILABLE);
    });

    it('completes when stream ends', async () => {
      const mockStream = createMockStream();
      mockClient.subscribeAll.mockReturnValue(mockStream);

      const events$ = service.subscribeAll();
      const resultPromise = firstValueFrom(events$.pipe(toArray()));

      mockStream.emit('end');

      const events = await resultPromise;
      expect(events).toHaveLength(0);
    });
  });

  // ─── Retry logic ─────────────────────────────────────────

  describe('retry logic', () => {
    it('retries transient UNAVAILABLE errors', async () => {
      let callCount = 0;
      mockClient.createProfile.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => {
          callCount++;
          if (callCount < 3) {
            cb({ code: grpc.status.UNAVAILABLE, details: 'Connection refused' });
          } else {
            cb(null, { id: 'prof-retry' });
          }
        },
      );

      const result = await service.createProfile({ name: 'retry-test' });
      expect(result.id).toBe('prof-retry');
      expect(callCount).toBe(3);
    });

    it('does not retry non-transient errors', async () => {
      let callCount = 0;
      mockClient.createProfile.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => {
          callCount++;
          cb({ code: grpc.status.NOT_FOUND, details: 'Not found' });
        },
      );

      await expect(service.createProfile({ name: 'no-retry' })).rejects.toThrow(BriaClientError);
      expect(callCount).toBe(1);
    });

    it('gives up after max retries', async () => {
      let callCount = 0;
      mockClient.createProfile.mockImplementation(
        (_req: unknown, _md: unknown, _opts: unknown, cb: (...args: unknown[]) => void) => {
          callCount++;
          cb({ code: grpc.status.UNAVAILABLE, details: 'Still down' });
        },
      );

      await expect(service.createProfile({ name: 'exhaust' })).rejects.toThrow(BriaClientError);
      // initial + 3 retries = 4 calls
      expect(callCount).toBe(4);
    });
  });

  // ─── Metadata ────────────────────────────────────────────

  describe('metadata', () => {
    it('attaches x-bria-api-key header to every call', async () => {
      mockClient.newAddress.mockImplementation(
        (_req: unknown, md: grpc.Metadata, _opts: unknown, cb: (...args: unknown[]) => void) => {
          const keys = md.get('x-bria-api-key');
          expect(keys).toHaveLength(1);
          expect(keys[0]).toBe('test-api-key');
          cb(null, { address: 'tb1q_test' });
        },
      );
      await service.newAddress({ walletName: 'koya-hot' });
    });
  });
});
