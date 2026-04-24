import { WhatsAppTemplateService } from '../whatsapp-template.service';

describe('WhatsAppTemplateService', () => {
  let templates: WhatsAppTemplateService;
  const bodyOf = (message: { body: string }) => message.body;

  beforeEach(() => {
    templates = new WhatsAppTemplateService();
  });

  describe('message templates', () => {
    it('should generate welcome menu', () => {
      const msg = templates.welcomeMenu();
      expect(bodyOf(msg)).toContain('Koya');
      expect(bodyOf(msg)).toContain('WhatsApp');
      expect(bodyOf(msg)).toContain('1');
      expect(bodyOf(msg)).toContain('HELP');
      expect(bodyOf(msg)).toContain('CANCEL');
      expect(msg.interactive?.buttons).toEqual([
        { id: '1', title: 'Convert KES to BTC' },
        { id: '2', title: 'Live Rates' },
        { id: 'HELP', title: 'Help' },
      ]);
    });

    it('should generate amount prompt', () => {
      const msg = templates.askAmount();
      expect(bodyOf(msg)).toContain('KES');
      expect(bodyOf(msg)).toContain('100');
      expect(bodyOf(msg)).toContain('100,000');
      expect(msg.interactive).toBeUndefined();
    });

    it('should generate Telegram welcome menu with explicit intents', () => {
      const msg = templates.welcomeMenu('TELEGRAM');
      expect(bodyOf(msg)).toContain('Telegram Desk');
      expect(msg.interactive?.buttons).toEqual([
        { id: 'menu:start_conversion', title: 'Start Conversion' },
        { id: 'menu:track_order', title: 'Track Order' },
        { id: 'menu:transactions', title: 'Transactions' },
        { id: 'menu:help', title: 'Help' },
      ]);
    });

    it('should generate Telegram start conversion prompt with back/restart', () => {
      const msg = templates.askAmount('TELEGRAM');
      expect(bodyOf(msg)).toContain('Start Conversion');
      expect(msg.interactive?.buttons).toEqual([
        { id: 'menu:back', title: 'Back' },
        { id: 'menu:restart', title: 'Restart' },
      ]);
    });

    it('should generate quote display', () => {
      const msg = templates.showQuote({
        quoteId: 'q1',
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: '1000',
        targetAmount: '0.00000881',
        rate: '0.0000000881',
        fee: '15.00',
        spread: '0.015',
        expiresAt: new Date().toISOString(),
      });
      expect(bodyOf(msg)).toContain('KES 1000');
      expect(bodyOf(msg)).toContain('0.00000881');
      expect(bodyOf(msg)).toContain('1 BTC =');
      expect(bodyOf(msg)).toContain('KES');
      expect(bodyOf(msg)).toContain('YES');
      expect(msg.interactive?.buttons).toEqual([
        { id: 'YES', title: 'Continue' },
        { id: 'CANCEL', title: 'Cancel' },
      ]);
    });

    it('should generate Kenyan phone recovery prompt', () => {
      const msg = templates.askMpesaPhone('+15551234567');
      expect(bodyOf(msg)).toContain('+15551234567');
      expect(bodyOf(msg)).toContain('Kenyan');
      expect(bodyOf(msg)).toContain('M-Pesa');
    });

    it('should generate help message with all commands', () => {
      const msg = templates.helpMessage();
      expect(bodyOf(msg)).toContain('STATUS');
      expect(bodyOf(msg)).toContain('CANCEL');
      expect(bodyOf(msg)).toContain('START OVER');
      expect(bodyOf(msg)).toContain('HELP');
    });

    it('should generate payment success message', () => {
      const msg = templates.paymentSuccess({
        guestRef: '123456789012',
        txHash: 'mock_abc123def456',
        btcAmount: '0.00000881',
        referenceCode: 'KYA-12345678',
      });
      expect(bodyOf(msg)).toContain('Complete');
      expect(bodyOf(msg)).toContain('KYA-12345678');
      expect(bodyOf(msg)).toContain('123456789012');
      expect(msg.interactive?.buttons).toEqual([
        { id: '1', title: 'New Conversion' },
      ]);
    });

    it('should generate session expired message', () => {
      const msg = templates.sessionExpired();
      expect(bodyOf(msg)).toContain('Timed Out');
      expect(msg.interactive?.buttons).toEqual([
        { id: '1', title: 'Start Again' },
      ]);
    });

    it('should generate cancel confirmation', () => {
      const msg = templates.cancelConfirmation();
      expect(bodyOf(msg)).toContain('Cancelled');
    });

    it('should generate Telegram track-order fallback and transactions menu', () => {
      const track = templates.trackOrderPrompt('TELEGRAM');
      expect(bodyOf(track)).toContain('Track Order');
      expect(track.interactive?.buttons).toEqual([
        { id: 'menu:start_conversion', title: 'Start Conversion' },
        { id: 'menu:back', title: 'Back' },
      ]);

      const transactions = templates.transactionsOverview('TELEGRAM');
      expect(bodyOf(transactions)).toContain('Transactions');
      expect(transactions.interactive?.buttons).toEqual([
        { id: 'menu:track_order', title: 'Track Order' },
        { id: 'menu:start_conversion', title: 'Start Conversion' },
        { id: 'menu:back', title: 'Back' },
      ]);
    });
  });

  describe('masking helpers', () => {
    it('should mask phone numbers', () => {
      expect(templates.maskPhone('+254712345678')).toBe('*********5678');
    });

    it('should mask document numbers', () => {
      expect(templates.maskDocumentNumber('12345678')).toBe('****5678');
    });

    it('should mask BTC addresses', () => {
      expect(
        templates.maskBtcAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'),
      ).toBe('1BvBMS...NVN2');
    });

    it('should handle short values', () => {
      expect(templates.maskPhone('1234')).toBe('1234');
      expect(templates.maskDocumentNumber('AB')).toBe('AB');
    });
  });
});
