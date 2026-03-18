import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppModule } from '../whatsapp.module';
import { WhatsAppService } from '../whatsapp.service';
import { WhatsAppSessionService } from '../whatsapp-session.service';
import { TWILIO_ADAPTER } from '../../providers/twilio-adapter.interface';
import { MockTwilioAdapter } from '../../providers/mock-twilio.adapter';
import { randomUUID } from 'crypto';

describe('WhatsApp Flow (Integration)', () => {
  let module: TestingModule;
  let whatsappService: WhatsAppService;
  let prisma: PrismaService;
  let mockTwilio: MockTwilioAdapter;
  const runSeed = String(Date.now()).slice(-4);
  let kenyaCounter = 0;
  let globalCounter = 0;

  const newKenyaPhone = (): string => {
    kenyaCounter += 1;
    return `+2547${runSeed}${String(kenyaCounter).padStart(4, '0')}`;
  };

  const newForeignPhone = (): string => {
    globalCounter += 1;
    return `+1555${runSeed}${String(globalCounter).padStart(6, '0')}`;
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        PrismaModule,
        WhatsAppModule,
      ],
    })
      .overrideProvider(TWILIO_ADAPTER)
      .useClass(MockTwilioAdapter)
      .compile();

    whatsappService = module.get(WhatsAppService);
    module.get(WhatsAppSessionService);
    prisma = module.get(PrismaService);
    mockTwilio = module.get(TWILIO_ADAPTER);
  }, 30000);

  afterAll(async () => {
    await module.close();
  });

  function newSid(): string {
    return `SM${randomUUID().replace(/-/g, '')}`;
  }

  describe('Conversation creation', () => {
    it('should create conversation on first message', async () => {
      const phone = newKenyaPhone();
      await whatsappService.handleInboundMessage(phone, 'hi', newSid());

      const conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: phone },
      });
      expect(conv).toBeTruthy();
      expect(conv?.status).toBe('ACTIVE');
    });

    it('should store inbound message event', async () => {
      const phone = newKenyaPhone();
      const sid = newSid();
      await whatsappService.handleInboundMessage(phone, 'hello', sid);

      const event = await prisma.whatsAppMessageEvent.findUnique({
        where: { twilioMessageSid: sid },
      });
      expect(event).toBeTruthy();
      expect(event?.direction).toBe('INBOUND');
      expect(event?.body).toBe('hello');
    });

    it('should send outbound reply', async () => {
      const phone = newKenyaPhone();
      const before = mockTwilio.sentMessages.length;
      await whatsappService.handleInboundMessage(phone, 'hi', newSid());

      // Wait for async processing
      await new Promise((r) => setTimeout(r, 200));

      const sent = mockTwilio.sentMessages.slice(before);
      expect(sent.length).toBeGreaterThanOrEqual(1);
      expect(sent[0]?.to).toBe(phone);
    });
  });

  describe('Idempotency', () => {
    it('should ignore duplicate message SID', async () => {
      const phone = newKenyaPhone();
      const sid = newSid();

      await whatsappService.handleInboundMessage(phone, 'hi', sid);
      const count1 = await prisma.whatsAppMessageEvent.count({
        where: { twilioMessageSid: sid },
      });

      // Send again with same SID
      await whatsappService.handleInboundMessage(phone, 'hi', sid);
      const count2 = await prisma.whatsAppMessageEvent.count({
        where: { twilioMessageSid: sid },
      });

      expect(count1).toBe(1);
      expect(count2).toBe(1); // Not duplicated
    });
  });

  describe('Full conversion flow via WhatsApp', () => {
    it('should complete amount → quote → session → identity → payout → payment flow', async () => {
      const flowPhone = newKenyaPhone();
      // Step 1: Start — greeting
      await whatsappService.handleInboundMessage(flowPhone, 'hi', newSid());
      await new Promise((r) => setTimeout(r, 100));

      // Step 2: Select option 1 (convert)
      await whatsappService.handleInboundMessage(flowPhone, '1', newSid());
      await new Promise((r) => setTimeout(r, 100));

      let conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: flowPhone, status: 'ACTIVE' },
      });
      expect(conv?.currentStep).toBe('WAITING_FOR_AMOUNT');

      // Step 3: Enter amount
      await whatsappService.handleInboundMessage(flowPhone, '1000', newSid());
      await new Promise((r) => setTimeout(r, 300));

      conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: flowPhone, status: 'ACTIVE' },
      });
      expect(conv?.currentStep).toBe('WAITING_FOR_QUOTE_CONFIRMATION');
      expect(conv?.quoteId).toBeTruthy();

      // Step 4: Confirm quote
      await whatsappService.handleInboundMessage(flowPhone, 'YES', newSid());
      await new Promise((r) => setTimeout(r, 300));

      conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: flowPhone, status: 'ACTIVE' },
      });
      expect(conv?.currentStep).toBe('WAITING_FOR_FULL_NAME');
      expect(conv?.conversionSessionId).toBeTruthy();

      // Step 5: Full name
      await whatsappService.handleInboundMessage(
        flowPhone,
        'John Doe',
        newSid(),
      );
      await new Promise((r) => setTimeout(r, 100));

      conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: flowPhone, status: 'ACTIVE' },
      });
      expect(conv?.currentStep).toBe('WAITING_FOR_DOCUMENT_NUMBER');

      // Step 6: Document number
      await whatsappService.handleInboundMessage(
        flowPhone,
        '12345678',
        newSid(),
      );
      await new Promise((r) => setTimeout(r, 100));

      conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: flowPhone, status: 'ACTIVE' },
      });
      expect(conv?.currentStep).toBe('WAITING_FOR_EMAIL');

      // Step 7: Skip email
      await whatsappService.handleInboundMessage(
        flowPhone,
        'SKIP',
        newSid(),
      );
      await new Promise((r) => setTimeout(r, 300));

      conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: flowPhone, status: 'ACTIVE' },
      });
      expect(conv?.currentStep).toBe('WAITING_FOR_BTC_ADDRESS');

      // Step 8: BTC address
      await whatsappService.handleInboundMessage(
        flowPhone,
        '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
        newSid(),
      );
      await new Promise((r) => setTimeout(r, 300));

      conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: flowPhone, status: 'ACTIVE' },
      });
      expect(conv?.currentStep).toBe('WAITING_FOR_PAYMENT_CONFIRMATION');

      // Step 9: PAY
      await whatsappService.handleInboundMessage(flowPhone, 'PAY', newSid());
      await new Promise((r) => setTimeout(r, 300));

      conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: flowPhone, status: 'ACTIVE' },
      });
      expect(conv?.currentStep).toBe('PROCESSING');

      // Step 10: Manual reference confirmation
      await whatsappService.handleInboundMessage(
        flowPhone,
        'REF ABCDEF1234',
        newSid(),
      );
      await new Promise((r) => setTimeout(r, 500));

      conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: flowPhone },
        orderBy: { createdAt: 'desc' },
      });
      expect(conv?.currentStep).toBe('COMPLETED');
    }, 30000);
  });

  describe('Non-Kenyan WhatsApp number recovery', () => {
    it('should ask for a Kenyan number and continue the flow', async () => {
      const phone = newForeignPhone();

      await whatsappService.handleInboundMessage(phone, 'hi', newSid());
      await new Promise((r) => setTimeout(r, 100));
      await whatsappService.handleInboundMessage(phone, '1', newSid());
      await new Promise((r) => setTimeout(r, 100));
      await whatsappService.handleInboundMessage(phone, '1000', newSid());
      await new Promise((r) => setTimeout(r, 300));
      await whatsappService.handleInboundMessage(phone, 'YES', newSid());
      await new Promise((r) => setTimeout(r, 300));
      await whatsappService.handleInboundMessage(phone, 'John Doe', newSid());
      await new Promise((r) => setTimeout(r, 100));
      await whatsappService.handleInboundMessage(phone, '12345678', newSid());
      await new Promise((r) => setTimeout(r, 100));

      const beforePrompt = mockTwilio.sentMessages.length;
      await whatsappService.handleInboundMessage(phone, 'SKIP', newSid());
      await new Promise((r) => setTimeout(r, 300));

      const promptMessages = mockTwilio.sentMessages.slice(beforePrompt);
      expect(
        promptMessages.some((m) => m.body.includes('Kenyan Number Needed')),
      ).toBe(true);

      let conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: phone, status: 'ACTIVE' },
      });
      expect(conv?.currentStep).toBe('WAITING_FOR_EMAIL');

      await whatsappService.handleInboundMessage(phone, '0712345678', newSid());
      await new Promise((r) => setTimeout(r, 300));

      conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: phone, status: 'ACTIVE' },
      });
      expect(conv?.currentStep).toBe('WAITING_FOR_BTC_ADDRESS');
    }, 20000);
  });

  describe('CANCEL command', () => {
    it('should reset conversation on CANCEL', async () => {
      const phone = newKenyaPhone();

      // Start a flow
      await whatsappService.handleInboundMessage(phone, '1', newSid());
      await new Promise((r) => setTimeout(r, 100));

      // Cancel
      await whatsappService.handleInboundMessage(phone, 'CANCEL', newSid());
      await new Promise((r) => setTimeout(r, 100));

      const conv = await prisma.whatsAppConversation.findFirst({
        where: { phoneNumber: phone, status: 'ACTIVE' },
      });
      expect(conv?.currentStep).toBe('IDLE');
    });
  });

  describe('HELP command', () => {
    it('should return help from any step', async () => {
      const phone = newKenyaPhone();
      const before = mockTwilio.sentMessages.length;

      await whatsappService.handleInboundMessage(phone, 'HELP', newSid());
      await new Promise((r) => setTimeout(r, 200));

      const sent = mockTwilio.sentMessages.slice(before);
      expect(sent.some((m) => m.body.includes('Commands'))).toBe(true);
    });
  });

  describe('STATUS command', () => {
    it('should return status during active conversion', async () => {
      const phone = newKenyaPhone();

      // Start flow and get to amount stage
      await whatsappService.handleInboundMessage(phone, '1', newSid());
      await new Promise((r) => setTimeout(r, 100));
      await whatsappService.handleInboundMessage(phone, '500', newSid());
      await new Promise((r) => setTimeout(r, 200));
      await whatsappService.handleInboundMessage(phone, 'YES', newSid());
      await new Promise((r) => setTimeout(r, 300));

      const before = mockTwilio.sentMessages.length;
      await whatsappService.handleInboundMessage(phone, 'STATUS', newSid());
      await new Promise((r) => setTimeout(r, 200));

      const sent = mockTwilio.sentMessages.slice(before);
      expect(sent.some((m) => m.body.includes('Status'))).toBe(true);
    }, 15000);
  });
});
