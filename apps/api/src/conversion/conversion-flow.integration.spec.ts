import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConversionService } from './conversion.service';
import { QuoteService } from './quote.service';
import { SessionService } from './session.service';
import { PrismaModule } from '../prisma/prisma.module';
import { KycModule } from '../kyc/kyc.module';
import { PaymentsModule } from '../payments/payments.module';
import { RiskModule } from '../risk/risk.module';
import { RATE_PROVIDER } from '../providers/rate-provider.interface';
import { MockRateProvider } from '../providers/mock-rate.provider';
import { BTC_DELIVERY_PROVIDER } from '../providers/btc-delivery.interface';
import { MockBtcDeliveryProvider } from '../providers/mock-btc-delivery.provider';
import { SWAP_PROVIDER } from '../providers/swap-provider.interface';
import { MockSwapProvider } from '../providers/mock-swap.provider';
import { PrismaService } from '../prisma/prisma.service';

describe('Conversion Flow (Integration)', () => {
  let module: TestingModule;
  let conversionService: ConversionService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env['BTC_NETWORK'] = 'testnet4';

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        PrismaModule,
        KycModule,
        PaymentsModule,
        RiskModule,
      ],
      providers: [
        ConversionService,
        QuoteService,
        SessionService,
        { provide: RATE_PROVIDER, useClass: MockRateProvider },
        { provide: BTC_DELIVERY_PROVIDER, useClass: MockBtcDeliveryProvider },
        { provide: SWAP_PROVIDER, useClass: MockSwapProvider },
      ],
    }).compile();

    conversionService = module.get(ConversionService);
    prisma = module.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Quote creation', () => {
    it('should create a quote for KES→BTC', async () => {
      const result = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });

      expect(result.quoteId).toBeDefined();
      expect(result.sourceAsset).toBe('KES');
      expect(result.targetAsset).toBe('BTC');
      expect(result.sourceAmount).toBe('1000');
      expect(parseFloat(result.targetAmount)).toBeGreaterThan(0);
      expect(result.rate).toBe('0.0000000881');
      expect(parseFloat(result.fee)).toBeGreaterThan(0);
      expect(result.expiresAt).toBeDefined();

      // Verify persisted in DB
      const dbQuote = await prisma.conversionQuote.findUnique({
        where: { id: result.quoteId },
      });
      expect(dbQuote).not.toBeNull();
      expect(dbQuote?.status).toBe('READY');
    });

    it('should reject unsupported route', async () => {
      await expect(
        conversionService.createQuote({
          sourceAsset: 'KES',
          targetAsset: 'USDC',
          sourceAmount: '1000',
          channel: 'WEB',
        }),
      ).rejects.toThrow('not supported');
    });

    it('should reject amount below minimum', async () => {
      await expect(
        conversionService.createQuote({
          sourceAsset: 'KES',
          targetAsset: 'BTC',
          sourceAmount: '50', // 50 KES = 5000 minor, below 10000 min
          channel: 'WEB',
        }),
      ).rejects.toThrow('Minimum');
    });
  });

  describe('Session creation', () => {
    it('should create a session from a valid quote', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });

      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });

      expect(session.sessionId).toBeDefined();
      expect(session.currentState).toBe('IDENTITY_PENDING');
      expect(session.referenceCode).toMatch(/^KYA-[A-F0-9]{8}$/);

      // Verify in DB
      const dbSession = await prisma.conversionSession.findUnique({
        where: { id: session.sessionId },
      });
      expect(dbSession).not.toBeNull();
      expect(dbSession?.currentState).toBe('IDENTITY_PENDING');
      expect(dbSession?.quoteId).toBe(quote.quoteId);
    });

    it('should reject an already-used quote', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });

      await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });

      // Using same quote again
      await expect(
        conversionService.createSession({
          quoteId: quote.quoteId,
          channel: 'WEB',
        }),
      ).rejects.toThrow('already been used');
    });
  });

  describe('Identity submission', () => {
    it('should submit identity and move to PAYOUT_DETAILS_PENDING', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });

      const result = await conversionService.submitIdentity(session.sessionId, {
        fullName: 'John Doe',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: '12345678',
        phone: '0712345678',
        email: 'john@example.com',
      });

      expect(result.compliancePassed).toBe(true);
      expect(result.currentState).toBe('PAYOUT_DETAILS_PENDING');
      expect(result.guestRef).toBeDefined();

      // Verify guest profile created/linked
      const dbSession = await prisma.conversionSession.findUnique({
        where: { id: session.sessionId },
      });
      expect(dbSession?.guestProfileId).not.toBeNull();
    });

    it('should fail compliance for FAIL-prefixed documents', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });

      const result = await conversionService.submitIdentity(session.sessionId, {
        fullName: 'Bad Actor',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: 'FAIL999',
        phone: '0712999999',
      });

      expect(result.compliancePassed).toBe(false);
    });

    it('should reject identity in wrong state', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });

      // Submit identity (moves to PAYOUT_DETAILS_PENDING)
      await conversionService.submitIdentity(session.sessionId, {
        fullName: 'Jane Doe',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: '87654321',
        phone: '0712111111',
      });

      // Try submitting identity again
      await expect(
        conversionService.submitIdentity(session.sessionId, {
          fullName: 'Jane Doe',
          countryCode: 'KE',
          documentType: 'NATIONAL_ID',
          documentNumber: '87654321',
          phone: '0712111111',
        }),
      ).rejects.toThrow('Cannot submit identity');
    });
  });

  describe('Payout details', () => {
    it('should submit BTC address and transition to PAYMENT_PENDING', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });
      await conversionService.submitIdentity(session.sessionId, {
        fullName: 'Test User',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: 'PAYOUT12345',
        phone: '0712222222',
      });

      const result = await conversionService.submitPayoutDetails(
        session.sessionId,
        'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      );

      expect(result.currentState).toBe('PAYMENT_PENDING');

      // Verify payout instruction in DB
      const payout = await prisma.payoutInstruction.findUnique({
        where: { conversionSessionId: session.sessionId },
      });
      expect(payout).not.toBeNull();
      expect(payout?.btcAddress).toBe('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn');
    });

    it('should reject invalid BTC address', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });
      await conversionService.submitIdentity(session.sessionId, {
        fullName: 'Test User',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: 'INVALID_BTC_1',
        phone: '0712333333',
      });

      await expect(
        conversionService.submitPayoutDetails(session.sessionId, 'invalid-address'),
      ).rejects.toThrow('Invalid BTC address');
    });

    it('should reject network-mismatched BTC address', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });
      await conversionService.submitIdentity(session.sessionId, {
        fullName: 'Test User',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: 'INVALID_BTC_2',
        phone: '0712444444',
      });

      await expect(
        conversionService.submitPayoutDetails(
          session.sessionId,
          'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        ),
      ).rejects.toThrow('configured network (testnet4)');
    });
  });

  describe('Identity dedup', () => {
    it('should reuse guest profile for same identity across sessions', async () => {
      const docNumber = `DEDUP${Date.now()}`;

      // First session
      const quote1 = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session1 = await conversionService.createSession({
        quoteId: quote1.quoteId,
        channel: 'WEB',
      });
      const result1 = await conversionService.submitIdentity(session1.sessionId, {
        fullName: 'Dedup User',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: docNumber,
        phone: '0712444444',
      });

      // Second session with same identity
      const quote2 = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '2000',
        channel: 'WEB',
      });
      const session2 = await conversionService.createSession({
        quoteId: quote2.quoteId,
        channel: 'WEB',
      });
      const result2 = await conversionService.submitIdentity(session2.sessionId, {
        fullName: 'Dedup User',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: docNumber,
        phone: '0712444444',
      });

      // Same guest ref
      expect(result1.guestRef).toBe(result2.guestRef);

      // Same guest profile linked to both sessions
      const s1 = await prisma.conversionSession.findUnique({
        where: { id: session1.sessionId },
      });
      const s2 = await prisma.conversionSession.findUnique({
        where: { id: session2.sessionId },
      });
      expect(s1?.guestProfileId).toBe(s2?.guestProfileId);
    });
  });

  describe('Status check', () => {
    it('should return current status for a session', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });

      const status = await conversionService.getStatus(session.sessionId);

      expect(status.sessionId).toBe(session.sessionId);
      expect(status.currentState).toBe('IDENTITY_PENDING');
      expect(status.referenceCode).toBeDefined();
      expect(status.sourceAsset).toBe('KES');
      expect(status.targetAsset).toBe('BTC');
    });
  });

  describe('Order expiry', () => {
    it('should reject submitIdentity when order has expired', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });

      // Manually expire the session
      await prisma.conversionSession.update({
        where: { id: session.sessionId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      await expect(
        conversionService.submitIdentity(session.sessionId, {
          fullName: 'Expired User',
          countryCode: 'KE',
          documentType: 'NATIONAL_ID',
          documentNumber: 'EXP12345',
          phone: '0712555555',
        }),
      ).rejects.toThrow('order has expired');

      // Verify session transitioned to EXPIRED
      const dbSession = await prisma.conversionSession.findUnique({
        where: { id: session.sessionId },
      });
      expect(dbSession?.currentState).toBe('EXPIRED');
    });

    it('should reject submitPayoutDetails when order has expired', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });
      await conversionService.submitIdentity(session.sessionId, {
        fullName: 'Payout Expire',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: 'PAYEXP123',
        phone: '0712666666',
      });

      // Manually expire the session
      await prisma.conversionSession.update({
        where: { id: session.sessionId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      await expect(
        conversionService.submitPayoutDetails(
          session.sessionId,
          'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
        ),
      ).rejects.toThrow('order has expired');
    });

    it('should NOT expire sessions in post-payment states', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });
      await conversionService.submitIdentity(session.sessionId, {
        fullName: 'PostPay User',
        countryCode: 'KE',
        documentType: 'NATIONAL_ID',
        documentNumber: 'POSTPAY123',
        phone: '0712777777',
      });
      await conversionService.submitPayoutDetails(
        session.sessionId,
        'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
      );

      // Session is now PAYMENT_PENDING — set expiresAt to the past
      await prisma.conversionSession.update({
        where: { id: session.sessionId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      // getStatus should still work (no expiry enforcement for PAYMENT_PENDING)
      const status = await conversionService.getStatus(session.sessionId);
      expect(status.currentState).toBe('PAYMENT_PENDING');
    });

    it('should include expiresAt in status response', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });

      const status = await conversionService.getStatus(session.sessionId);
      expect(status.expiresAt).toBeDefined();
      expect(new Date(status.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Status by reference code', () => {
    it('should return status when looked up by reference code', async () => {
      const quote = await conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        channel: 'WEB',
      });
      const session = await conversionService.createSession({
        quoteId: quote.quoteId,
        channel: 'WEB',
      });

      const status = await conversionService.getStatusByReference(
        session.referenceCode,
      );

      expect(status.sessionId).toBe(session.sessionId);
      expect(status.referenceCode).toBe(session.referenceCode);
      expect(status.currentState).toBe('IDENTITY_PENDING');
      expect(status.sourceAsset).toBe('KES');
      expect(status.targetAsset).toBe('BTC');
      expect(status.expiresAt).toBeDefined();
    });

    it('should throw for non-existent reference code', async () => {
      await expect(
        conversionService.getStatusByReference('KYA-NOTFOUND'),
      ).rejects.toThrow('not found');
    });
  });
});
