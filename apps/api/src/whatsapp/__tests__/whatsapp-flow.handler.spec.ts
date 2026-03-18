import { WhatsAppFlowHandler } from '../whatsapp-flow.handler';
import { WhatsAppParserService } from '../whatsapp-parser.service';
import { WhatsAppTemplateService } from '../whatsapp-template.service';
import type { WhatsAppConversation } from '@prisma/client';
import type { WhatsAppOutboundMessage } from '../../providers/twilio-adapter.interface';

describe('WhatsAppFlowHandler', () => {
  let handler: WhatsAppFlowHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockConversionService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSessionSvc: any;
  let parser: WhatsAppParserService;
  let templates: WhatsAppTemplateService;
  const bodyOf = (message: WhatsAppOutboundMessage) => message.body;

  const baseConversation: WhatsAppConversation = {
    id: 'conv-1',
    phoneNumber: '+254712345678',
    status: 'ACTIVE',
    currentStep: 'IDLE',
    conversionSessionId: null,
    quoteId: null,
    metadata: null,
    lastInboundAt: new Date(),
    lastOutboundAt: null,
    expiresAt: new Date(Date.now() + 600_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    parser = new WhatsAppParserService();
    templates = new WhatsAppTemplateService();

    mockConversionService = {
      createQuote: jest.fn(),
      createSession: jest.fn(),
      submitIdentity: jest.fn(),
      submitPayoutDetails: jest.fn(),
      initiatePayment: jest.fn(),
      confirmByReference: jest.fn(),
      getStatus: jest.fn(),
    };

    mockSessionSvc = {
      updateStep: jest.fn(),
      linkQuote: jest.fn(),
      linkSession: jest.fn(),
      updateMetadata: jest.fn(),
      resetConversation: jest.fn(),
      createConversation: jest.fn(),
      setStatus: jest.fn(),
    };

    handler = new WhatsAppFlowHandler(
      mockConversionService,
      mockSessionSvc,
      parser,
      templates,
    );
  });

  describe('IDLE/MENU step', () => {
    it('should show amount prompt when user sends "1"', async () => {
      const result = await handler.handle(
        { ...baseConversation, currentStep: 'IDLE' },
        { type: 'MENU_SELECT', option: '1' },
      );

      expect(mockSessionSvc.updateStep).toHaveBeenCalledWith(
        'conv-1',
        'WAITING_FOR_AMOUNT',
      );
      expect(bodyOf(result)).toContain('KES');
    });

    it('should show amount prompt for greeting', async () => {
      const result = await handler.handle(
        { ...baseConversation, currentStep: 'IDLE' },
        { type: 'GREETING' },
      );

      expect(mockSessionSvc.updateStep).toHaveBeenCalledWith(
        'conv-1',
        'MENU',
      );
      expect(bodyOf(result)).toContain('Menu');
      expect(result.interactive?.buttons[0]?.id).toBe('1');
    });

    it('should show error for invalid menu selection', async () => {
      const result = await handler.handle(
        { ...baseConversation, currentStep: 'MENU' },
        { type: 'MENU_SELECT', option: '5' },
      );

      expect(bodyOf(result)).toContain('1');
    });
  });

  describe('WAITING_FOR_AMOUNT step', () => {
    it('should create quote for valid amount', async () => {
      mockConversionService.createQuote.mockResolvedValue({
        quoteId: 'q1',
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '2500',
        targetAmount: '0.00022025',
        rate: '0.0000000881',
        fee: '37.50',
        spread: '0.015',
        expiresAt: new Date().toISOString(),
      });

      const result = await handler.handle(
        { ...baseConversation, currentStep: 'WAITING_FOR_AMOUNT' },
        { type: 'TEXT', value: '2500' },
      );

      expect(mockConversionService.createQuote).toHaveBeenCalledWith({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '2500',
        channel: 'WHATSAPP',
      });
      expect(mockSessionSvc.linkQuote).toHaveBeenCalledWith('conv-1', 'q1');
      expect(bodyOf(result)).toContain('KES 2500');
      expect(result.interactive?.buttons.map((button) => button.id)).toEqual([
        'YES',
        'CANCEL',
      ]);
    });

    it('should reject invalid amount', async () => {
      const result = await handler.handle(
        { ...baseConversation, currentStep: 'WAITING_FOR_AMOUNT' },
        { type: 'TEXT', value: 'fifty' },
      );

      expect(mockConversionService.createQuote).not.toHaveBeenCalled();
      expect(bodyOf(result)).toContain('outside the allowed range');
    });
  });

  describe('WAITING_FOR_QUOTE_CONFIRMATION step', () => {
    it('should create session on YES', async () => {
      mockConversionService.createSession.mockResolvedValue({
        sessionId: 'sess-1',
        currentState: 'IDENTITY_PENDING',
        referenceCode: 'KYA-12345678',
      });

      const result = await handler.handle(
        {
          ...baseConversation,
          currentStep: 'WAITING_FOR_QUOTE_CONFIRMATION',
          quoteId: 'q1',
        },
        { type: 'YES' },
      );

      expect(mockConversionService.createSession).toHaveBeenCalledWith({
        quoteId: 'q1',
        channel: 'WHATSAPP',
      });
      expect(mockSessionSvc.linkSession).toHaveBeenCalledWith(
        'conv-1',
        'sess-1',
      );
      expect(bodyOf(result)).toContain('legal name');
    });

    it('should show expired when no quoteId', async () => {
      const result = await handler.handle(
        {
          ...baseConversation,
          currentStep: 'WAITING_FOR_QUOTE_CONFIRMATION',
          quoteId: null,
        },
        { type: 'YES' },
      );

      expect(bodyOf(result)).toContain('Quote Expired');
    });
  });

  describe('WAITING_FOR_FULL_NAME step', () => {
    it('should store name and advance', async () => {
      const result = await handler.handle(
        {
          ...baseConversation,
          currentStep: 'WAITING_FOR_FULL_NAME',
          metadata: {},
        },
        { type: 'TEXT', value: 'John Doe' },
      );

      expect(mockSessionSvc.updateMetadata).toHaveBeenCalledWith(
        'conv-1',
        expect.objectContaining({ fullName: 'John Doe' }),
      );
      expect(mockSessionSvc.updateStep).toHaveBeenCalledWith(
        'conv-1',
        'WAITING_FOR_DOCUMENT_NUMBER',
      );
      expect(bodyOf(result)).toContain('ID');
    });
  });

  describe('WAITING_FOR_EMAIL step', () => {
    it('should ask for a Kenyan number when WhatsApp number is not Kenyan', async () => {
      const result = await handler.handle(
        {
          ...baseConversation,
          phoneNumber: '+15551234567',
          currentStep: 'WAITING_FOR_EMAIL',
          conversionSessionId: 'sess-1',
          metadata: {
            fullName: 'John Doe',
            documentNumber: '12345678',
          },
        },
        { type: 'SKIP' },
      );

      expect(mockConversionService.submitIdentity).not.toHaveBeenCalled();
      expect(mockSessionSvc.updateMetadata).toHaveBeenCalledWith(
        'conv-1',
        expect.objectContaining({
          pendingField: 'MPESA_PHONE',
        }),
      );
      expect(bodyOf(result)).toContain('Kenyan');
      expect(bodyOf(result)).toContain('M-Pesa');
    });

    it('should accept replacement Kenyan number and submit identity', async () => {
      mockConversionService.submitIdentity.mockResolvedValue({
        compliancePassed: true,
        currentState: 'PAYOUT_DETAILS_PENDING',
      });

      const result = await handler.handle(
        {
          ...baseConversation,
          phoneNumber: '+15551234567',
          currentStep: 'WAITING_FOR_EMAIL',
          conversionSessionId: 'sess-1',
          metadata: {
            fullName: 'John Doe',
            documentNumber: '12345678',
            pendingField: 'MPESA_PHONE',
          },
        },
        { type: 'TEXT', value: '0712345678' },
      );

      expect(mockConversionService.submitIdentity).toHaveBeenCalledWith(
        'sess-1',
        expect.objectContaining({
          phone: '+254712345678',
        }),
      );
      expect(bodyOf(result)).toContain('Identity Verified');
    });
  });

  describe('WAITING_FOR_BTC_ADDRESS step', () => {
    it('should submit payout and advance to payment', async () => {
      mockConversionService.submitPayoutDetails.mockResolvedValue({
        sessionId: 'sess-1',
        currentState: 'PAYMENT_PENDING',
      });
      mockConversionService.getStatus.mockResolvedValue({
        sessionId: 'sess-1',
        currentState: 'PAYMENT_PENDING',
        sourceAmount: '2500',
        referenceCode: 'KYA-12345678',
      });

      const result = await handler.handle(
        {
          ...baseConversation,
          currentStep: 'WAITING_FOR_BTC_ADDRESS',
          conversionSessionId: 'sess-1',
        },
        { type: 'TEXT', value: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2' },
      );

      expect(mockConversionService.submitPayoutDetails).toHaveBeenCalledWith(
        'sess-1',
        '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
      );
      expect(bodyOf(result)).toContain('PAY');
      expect(result.interactive?.buttons.map((button) => button.id)).toEqual([
        'PAY',
        'CANCEL',
      ]);
    });
  });

  describe('WAITING_FOR_PAYMENT_CONFIRMATION step', () => {
    it('should initiate payment on PAY', async () => {
      mockConversionService.initiatePayment.mockResolvedValue({
        sessionId: 'sess-1',
        currentState: 'PAYMENT_PENDING',
        checkoutRequestId: 'MOCK-CR-1234',
        phone: '+254712345678',
      });
      mockConversionService.getStatus.mockResolvedValue({
        sessionId: 'sess-1',
        currentState: 'PAYMENT_PENDING',
        referenceCode: 'KYA-12345678',
        sourceAsset: 'KES',
        sourceAmount: '1000.00',
        targetAmount: '0.00000881',
        targetAsset: 'BTC',
      });

      const result = await handler.handle(
        {
          ...baseConversation,
          currentStep: 'WAITING_FOR_PAYMENT_CONFIRMATION',
          conversionSessionId: 'sess-1',
        },
        { type: 'PAY' },
      );

      expect(mockConversionService.initiatePayment).toHaveBeenCalledWith(
        'sess-1',
      );
      expect(mockSessionSvc.updateStep).toHaveBeenCalledWith(
        'conv-1',
        'PROCESSING',
      );
      expect(bodyOf(result)).toContain('STK Push Sent');
      expect(result.interactive?.buttons).toEqual([
        { id: 'STATUS', title: 'Check Status' },
      ]);
    });
  });

  describe('PROCESSING step', () => {
    it('should handle manual reference', async () => {
      mockConversionService.confirmByReference.mockResolvedValue({
        confirmed: true,
      });
      mockConversionService.getStatus.mockResolvedValue({
        sessionId: 'sess-1',
        currentState: 'COMPLETED',
        guestRef: '123456789012',
        txHash: 'mock_tx_hash',
        targetAmount: '0.00000881',
        referenceCode: 'KYA-12345678',
      });

      const result = await handler.handle(
        {
          ...baseConversation,
          currentStep: 'PROCESSING',
          conversionSessionId: 'sess-1',
        },
        { type: 'REFERENCE', code: 'ABCDEF1234' },
      );

      expect(mockConversionService.confirmByReference).toHaveBeenCalledWith(
        'sess-1',
        'ABCDEF1234',
      );
      expect(bodyOf(result)).toContain('Complete');
    });
  });
});
