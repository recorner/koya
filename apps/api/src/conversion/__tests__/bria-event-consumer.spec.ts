import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Subject } from 'rxjs';
import { BriaEventConsumerService } from '../bria-event-consumer.service';
import { SessionService } from '../session.service';
import { PsbtSigningService } from '../psbt-signing.service';
import { RedisCursorStore } from '../redis-cursor.store';
import { PrismaService } from '../../prisma/prisma.service';
import { BriaClientService, BriaEvent } from '@koya/bria-adapter';

describe('BriaEventConsumerService', () => {
  let consumer: BriaEventConsumerService;
  let briaClient: jest.Mocked<BriaClientService>;
  let prisma: any;
  let sessionService: jest.Mocked<SessionService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let psbtSigningService: jest.Mocked<PsbtSigningService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let cursorStore: jest.Mocked<RedisCursorStore>;
  let streams: Subject<BriaEvent>[];

  const createModule = async (driver = 'bria') => {
    streams = [];

    const mockBriaClient = {
      subscribeAll: jest.fn().mockImplementation(() => {
        const stream = new Subject<BriaEvent>();
        streams.push(stream);
        return stream.asObservable();
      }),
      getPayout: jest.fn(),
    };

    const mockPrisma = {
      payoutInstruction: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      conversionSession: {
        findUnique: jest.fn(),
      },
    };

    const mockSessionService = {
      transitionState: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockPsbtSigningService = {
      handlePayoutCommitted: jest.fn().mockResolvedValue(undefined),
      markSettled: jest.fn().mockResolvedValue(undefined),
    };

    const mockCursorStore = {
      getCursor: jest.fn().mockResolvedValue(null),
      setCursor: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BriaEventConsumerService,
        { provide: BriaClientService, useValue: mockBriaClient },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SessionService, useValue: mockSessionService },
        { provide: PsbtSigningService, useValue: mockPsbtSigningService },
        { provide: RedisCursorStore, useValue: mockCursorStore },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'BTC_DELIVERY_DRIVER') return driver;
              if (key === 'BRIA_STREAM_RECONNECT_BASE_MS') return '10';
              if (key === 'BRIA_STREAM_RECONNECT_MAX_MS') return '50';
              if (key === 'BRIA_STREAM_RECONNECT_JITTER_MS') return '0';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    consumer = module.get(BriaEventConsumerService);
    briaClient = module.get(BriaClientService);
    prisma = module.get(PrismaService);
    sessionService = module.get(SessionService);
    psbtSigningService = module.get(PsbtSigningService);
    eventEmitter = module.get(EventEmitter2);
    cursorStore = module.get(RedisCursorStore);

    return module;
  };

  afterEach(() => {
    jest.useRealTimers();
    for (const stream of streams ?? []) {
      if (!stream.closed) {
        stream.complete();
      }
    }
  });

  it('should skip subscription when driver is mock', async () => {
    await createModule('mock');
    await consumer.onModuleInit();

    expect(briaClient.subscribeAll).not.toHaveBeenCalled();
  });

  it('should subscribe to Bria events when driver is bria', async () => {
    await createModule('bria');
    await consumer.onModuleInit();

    expect(cursorStore.getCursor).toHaveBeenCalledWith('bria_event_consumer');
    expect(briaClient.subscribeAll).toHaveBeenCalledWith({ afterSequence: 0, augment: true });
  });

  it('should resume from stored cursor on init', async () => {
    await createModule('bria');
    cursorStore.getCursor.mockResolvedValue(42);
    await consumer.onModuleInit();

    expect(briaClient.subscribeAll).toHaveBeenCalledWith({ afterSequence: 42, augment: true });
  });

  it('should persist cursor after successful event processing', async () => {
    await createModule('bria');
    await consumer.onModuleInit();

    prisma.payoutInstruction.findFirst.mockResolvedValue(null);

    streams[0]!.next({
      sequence: 10,
      recordedAt: Date.now(),
      payload: {
        type: 'payout_submitted',
        data: { id: 'p-10', walletId: 'w1', payoutQueueId: 'q1', satoshis: 1000 },
      },
    });

    await new Promise((r) => setTimeout(r, 30));
    expect(cursorStore.setCursor).toHaveBeenCalledWith('bria_event_consumer', 10);
  });

  it('should update txHash on payout_broadcast', async () => {
    await createModule('bria');
    await consumer.onModuleInit();

    const mockPayout = { id: 'pi-1', conversionSessionId: 'sess-1', status: 'PENDING' };
    prisma.payoutInstruction.findFirst.mockResolvedValue(mockPayout);
    prisma.payoutInstruction.update.mockResolvedValue({});

    streams[0]!.next({
      sequence: 1,
      recordedAt: Date.now(),
      payload: {
        type: 'payout_broadcast',
        data: {
          id: 'bria-payout-1',
          walletId: 'w1',
          payoutQueueId: 'q1',
          satoshis: 100000,
          txId: 'real-txid-abc',
          vout: 0,
          proportionalFeeSats: 500,
        },
      },
    });

    await new Promise((r) => setTimeout(r, 30));

    expect(prisma.payoutInstruction.findFirst).toHaveBeenCalledWith({
      where: { providerPayoutId: 'bria-payout-1' },
    });
    expect(prisma.payoutInstruction.update).toHaveBeenCalledWith({
      where: { id: 'pi-1' },
      data: { txHash: 'real-txid-abc' },
    });
  });

  it('should transition session to COMPLETED on payout_settled', async () => {
    await createModule('bria');
    await consumer.onModuleInit();

    const mockPayout = { id: 'pi-2', conversionSessionId: 'sess-2', status: 'PENDING' };
    prisma.payoutInstruction.findFirst.mockResolvedValue(mockPayout);
    prisma.payoutInstruction.update.mockResolvedValue({});
    prisma.conversionSession.findUnique.mockResolvedValue({
      id: 'sess-2',
      currentState: 'DELIVERY_PENDING',
      channel: 'WEB',
    });
    sessionService.transitionState.mockResolvedValue(undefined as any);

    streams[0]!.next({
      sequence: 2,
      recordedAt: Date.now(),
      payload: {
        type: 'payout_settled',
        data: {
          id: 'bria-payout-2',
          walletId: 'w1',
          payoutQueueId: 'q1',
          satoshis: 100000,
          txId: 'settled-txid-xyz',
          vout: 0,
          proportionalFeeSats: 300,
        },
      },
    });

    await new Promise((r) => setTimeout(r, 30));

    expect(prisma.payoutInstruction.update).toHaveBeenCalledWith({
      where: { id: 'pi-2' },
      data: { status: 'CONFIRMED', txHash: 'settled-txid-xyz' },
    });
    expect(sessionService.transitionState).toHaveBeenCalledWith(
      'sess-2',
      'COMPLETED',
      'btc_settled_onchain',
      { txId: 'settled-txid-xyz', briaPayoutId: 'bria-payout-2' },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith('conversion.completed', {
      sessionId: 'sess-2',
      channel: 'WEB',
    });
  });

  it('should skip already CONFIRMED payouts on payout_settled (idempotent)', async () => {
    await createModule('bria');
    await consumer.onModuleInit();

    const mockPayout = { id: 'pi-3', conversionSessionId: 'sess-3', status: 'CONFIRMED' };
    prisma.payoutInstruction.findFirst.mockResolvedValue(mockPayout);

    streams[0]!.next({
      sequence: 3,
      recordedAt: Date.now(),
      payload: {
        type: 'payout_settled',
        data: {
          id: 'bria-payout-3',
          walletId: 'w1',
          payoutQueueId: 'q1',
          satoshis: 50000,
          txId: 'dup-txid',
          vout: 0,
          proportionalFeeSats: 200,
        },
      },
    });

    await new Promise((r) => setTimeout(r, 30));

    expect(prisma.payoutInstruction.update).not.toHaveBeenCalled();
    expect(sessionService.transitionState).not.toHaveBeenCalled();
  });

  it('should auto-reconnect when stream errors', async () => {
    jest.useFakeTimers();
    await createModule('bria');
    await consumer.onModuleInit();

    expect(briaClient.subscribeAll).toHaveBeenCalledTimes(1);

    streams[0]!.error(new Error('connection dropped'));

    await jest.advanceTimersByTimeAsync(15);
    expect(briaClient.subscribeAll).toHaveBeenCalledTimes(2);
    expect(briaClient.subscribeAll).toHaveBeenNthCalledWith(2, { afterSequence: 0, augment: true });
  });

  it('should not advance cursor on handler failure and should reconnect from last committed cursor', async () => {
    jest.useFakeTimers();
    await createModule('bria');
    await consumer.onModuleInit();

    prisma.payoutInstruction.findFirst.mockResolvedValue({
      id: 'pi-fail',
      conversionSessionId: 'sess-fail',
      status: 'PENDING',
    });
    prisma.payoutInstruction.update.mockRejectedValue(new Error('db write failed'));

    streams[0]!.next({
      sequence: 1,
      recordedAt: Date.now(),
      payload: {
        type: 'payout_submitted',
        data: { id: 'p-1', walletId: 'w1', payoutQueueId: 'q1', satoshis: 1000 },
      },
    });

    await jest.advanceTimersByTimeAsync(20);
    expect(cursorStore.setCursor).toHaveBeenCalledWith('bria_event_consumer', 1);

    streams[0]!.next({
      sequence: 2,
      recordedAt: Date.now(),
      payload: {
        type: 'payout_broadcast',
        data: {
          id: 'bria-payout-fail',
          walletId: 'w1',
          payoutQueueId: 'q1',
          satoshis: 100000,
          txId: 'tx-fail',
          vout: 0,
          proportionalFeeSats: 500,
        },
      },
    });

    await jest.advanceTimersByTimeAsync(15);

    expect(cursorStore.setCursor).not.toHaveBeenCalledWith('bria_event_consumer', 2);
    expect(briaClient.subscribeAll).toHaveBeenCalledTimes(2);
    expect(briaClient.subscribeAll).toHaveBeenNthCalledWith(2, { afterSequence: 1, augment: true });
  });

  it('should expose connectivity status', async () => {
    await createModule('bria');
    await consumer.onModuleInit();

    const status = consumer.getConnectivityStatus();
    expect(status.enabled).toBe(true);
    expect(status.driver).toBe('bria');
    expect(status.connected).toBe(true);
    expect(status.committedCursor).toBe(0);
  });

  it('should unsubscribe on destroy', async () => {
    await createModule('bria');
    await consumer.onModuleInit();

    consumer.onModuleDestroy();

    prisma.payoutInstruction.findFirst.mockResolvedValue(null);
    streams[0]!.next({
      sequence: 99,
      recordedAt: Date.now(),
      payload: {
        type: 'payout_broadcast',
        data: {
          id: 'after-destroy',
          walletId: 'w1',
          payoutQueueId: 'q1',
          satoshis: 5000,
          txId: 'ignored',
          vout: 0,
          proportionalFeeSats: 50,
        },
      },
    });

    await new Promise((r) => setTimeout(r, 30));
    expect(prisma.payoutInstruction.findFirst).not.toHaveBeenCalled();
  });
});
