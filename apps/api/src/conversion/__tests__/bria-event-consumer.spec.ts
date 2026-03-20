import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Subject } from 'rxjs';
import { BriaEventConsumerService } from '../bria-event-consumer.service';
import { SessionService } from '../session.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BriaClientService, BriaEvent } from '@koya/bria-adapter';

describe('BriaEventConsumerService', () => {
  let consumer: BriaEventConsumerService;
  let briaClient: jest.Mocked<BriaClientService>;
  let prisma: any;
  let sessionService: jest.Mocked<SessionService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let eventSubject: Subject<BriaEvent>;

  const createModule = async (driver = 'bria') => {
    eventSubject = new Subject<BriaEvent>();

    const mockBriaClient = {
      subscribeAll: jest.fn().mockReturnValue(eventSubject.asObservable()),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BriaEventConsumerService,
        { provide: BriaClientService, useValue: mockBriaClient },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SessionService, useValue: mockSessionService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'BTC_DELIVERY_DRIVER') return driver;
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
    eventEmitter = module.get(EventEmitter2);

    return module;
  };

  afterEach(() => {
    if (eventSubject && !eventSubject.closed) {
      eventSubject.complete();
    }
  });

  it('should skip subscription when driver is mock', async () => {
    await createModule('mock');
    consumer.onModuleInit();

    expect(briaClient.subscribeAll).not.toHaveBeenCalled();
  });

  it('should subscribe to Bria events when driver is bria', async () => {
    await createModule('bria');
    consumer.onModuleInit();

    expect(briaClient.subscribeAll).toHaveBeenCalledWith({ afterSequence: 0 });
  });

  it('should update txHash on payout_broadcast', async () => {
    await createModule('bria');
    consumer.onModuleInit();

    const mockPayout = { id: 'pi-1', conversionSessionId: 'sess-1', status: 'PENDING' };
    prisma.payoutInstruction.findFirst.mockResolvedValue(mockPayout);
    prisma.payoutInstruction.update.mockResolvedValue({});

    eventSubject.next({
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

    // Wait for async handler
    await new Promise((r) => setTimeout(r, 50));

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
    consumer.onModuleInit();

    const mockPayout = { id: 'pi-2', conversionSessionId: 'sess-2', status: 'PENDING' };
    prisma.payoutInstruction.findFirst.mockResolvedValue(mockPayout);
    prisma.payoutInstruction.update.mockResolvedValue({});
    prisma.conversionSession.findUnique.mockResolvedValue({
      id: 'sess-2',
      currentState: 'DELIVERY_PENDING',
      channel: 'WEB',
    });
    sessionService.transitionState.mockResolvedValue(undefined as any);

    eventSubject.next({
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

    await new Promise((r) => setTimeout(r, 50));

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
    consumer.onModuleInit();

    const mockPayout = { id: 'pi-3', conversionSessionId: 'sess-3', status: 'CONFIRMED' };
    prisma.payoutInstruction.findFirst.mockResolvedValue(mockPayout);

    eventSubject.next({
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

    await new Promise((r) => setTimeout(r, 50));

    expect(prisma.payoutInstruction.update).not.toHaveBeenCalled();
    expect(sessionService.transitionState).not.toHaveBeenCalled();
  });

  it('should skip events for unknown payouts', async () => {
    await createModule('bria');
    consumer.onModuleInit();

    prisma.payoutInstruction.findFirst.mockResolvedValue(null);

    eventSubject.next({
      sequence: 4,
      recordedAt: Date.now(),
      payload: {
        type: 'payout_broadcast',
        data: {
          id: 'unknown-payout',
          walletId: 'w1',
          payoutQueueId: 'q1',
          satoshis: 10000,
          txId: 'some-txid',
          vout: 0,
          proportionalFeeSats: 100,
        },
      },
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(prisma.payoutInstruction.update).not.toHaveBeenCalled();
  });

  it('should unsubscribe on destroy', async () => {
    await createModule('bria');
    consumer.onModuleInit();

    expect(briaClient.subscribeAll).toHaveBeenCalled();

    consumer.onModuleDestroy();

    // After destroy, emitting events should not trigger handlers
    prisma.payoutInstruction.findFirst.mockResolvedValue(null);
    eventSubject.next({
      sequence: 5,
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

    await new Promise((r) => setTimeout(r, 50));
    expect(prisma.payoutInstruction.findFirst).not.toHaveBeenCalled();
  });
});
