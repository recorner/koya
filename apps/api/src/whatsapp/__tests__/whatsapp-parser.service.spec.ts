import { WhatsAppParserService } from '../whatsapp-parser.service';

describe('WhatsAppParserService', () => {
  let parser: WhatsAppParserService;
  const payload = (body: string, buttonPayload?: string, buttonText?: string) => ({
    body,
    buttonPayload,
    buttonText,
  });

  beforeEach(() => {
    parser = new WhatsAppParserService();
  });

  describe('parseCommand', () => {
    it('should parse HELP command', () => {
      expect(parser.parseCommand(payload('HELP'))).toEqual({ type: 'HELP' });
      expect(parser.parseCommand(payload('help'))).toEqual({ type: 'HELP' });
      expect(parser.parseCommand(payload('  HELP  '))).toEqual({ type: 'HELP' });
    });

    it('should parse CANCEL command', () => {
      expect(parser.parseCommand(payload('CANCEL'))).toEqual({ type: 'CANCEL' });
    });

    it('should parse START OVER command', () => {
      expect(parser.parseCommand(payload('START OVER'))).toEqual({
        type: 'START_OVER',
      });
    });

    it('should parse STATUS command', () => {
      expect(parser.parseCommand(payload('STATUS'))).toEqual({ type: 'STATUS' });
    });

    it('should parse YES command', () => {
      expect(parser.parseCommand(payload('YES'))).toEqual({ type: 'YES' });
      expect(parser.parseCommand(payload('yes'))).toEqual({ type: 'YES' });
    });

    it('should parse PAY command', () => {
      expect(parser.parseCommand(payload('PAY'))).toEqual({ type: 'PAY' });
    });

    it('should parse SKIP command', () => {
      expect(parser.parseCommand(payload('SKIP'))).toEqual({ type: 'SKIP' });
    });

    it('should parse greetings', () => {
      expect(parser.parseCommand(payload('hi'))).toEqual({ type: 'GREETING' });
      expect(parser.parseCommand(payload('Hello'))).toEqual({
        type: 'GREETING',
      });
      expect(parser.parseCommand(payload('START'))).toEqual({
        type: 'GREETING',
      });
    });

    it('should parse menu selections', () => {
      expect(parser.parseCommand(payload('1'))).toEqual({
        type: 'MENU_SELECT',
        option: '1',
      });
      expect(parser.parseCommand(payload('2'))).toEqual({
        type: 'MENU_SELECT',
        option: '2',
      });
    });

    it('should parse REF command', () => {
      expect(parser.parseCommand(payload('REF ABC123DEF'))).toEqual({
        type: 'REFERENCE',
        code: 'ABC123DEF',
      });
      expect(parser.parseCommand(payload('ref qwerty12'))).toEqual({
        type: 'REFERENCE',
        code: 'QWERTY12',
      });
    });

    it('should reject REF with too-short code', () => {
      expect(parser.parseCommand(payload('REF AB'))).toEqual({
        type: 'TEXT',
        value: 'REF AB',
      });
    });

    it('should parse generic text', () => {
      expect(parser.parseCommand(payload('John Doe'))).toEqual({
        type: 'TEXT',
        value: 'John Doe',
      });
    });

    it('should prefer button payload over button text', () => {
      expect(
        parser.parseCommand(payload('Convert KES to BTC', '1', 'Convert KES to BTC')),
      ).toEqual({
        type: 'MENU_SELECT',
        option: '1',
      });
    });

    it('should fall back to button text when payload is not a known command', () => {
      expect(
        parser.parseCommand(payload('Continue', 'quote_yes', 'YES')),
      ).toEqual({ type: 'YES' });
    });

    it('should parse Telegram menu callback aliases', () => {
      expect(parser.parseCommand(payload('x', 'menu:start_conversion'))).toEqual({
        type: 'START_CONVERSION',
      });
      expect(parser.parseCommand(payload('x', 'menu:track_order'))).toEqual({
        type: 'STATUS',
      });
      expect(parser.parseCommand(payload('x', 'menu:transactions'))).toEqual({
        type: 'TRANSACTIONS',
      });
      expect(parser.parseCommand(payload('x', 'menu:help'))).toEqual({
        type: 'HELP',
      });
      expect(parser.parseCommand(payload('x', 'menu:back'))).toEqual({
        type: 'BACK',
      });
      expect(parser.parseCommand(payload('x', 'menu:restart'))).toEqual({
        type: 'START_OVER',
      });
      expect(parser.parseCommand(payload('START CONVERSION'))).toEqual({
        type: 'START_CONVERSION',
      });
    });
  });

  describe('parseAmount', () => {
    it('should parse valid KES amounts', () => {
      expect(parser.parseAmount('500')).toBe('500');
      expect(parser.parseAmount('2500')).toBe('2500');
      expect(parser.parseAmount('100000')).toBe('100000');
      expect(parser.parseAmount('100')).toBe('100');
      expect(parser.parseAmount('1000.50')).toBe('1000.50');
    });

    it('should strip commas and KES prefix', () => {
      expect(parser.parseAmount('2,500')).toBe('2500');
      expect(parser.parseAmount('KES 500')).toBe('500');
    });

    it('should reject invalid amounts', () => {
      expect(parser.parseAmount('fifty')).toBeNull();
      expect(parser.parseAmount('0')).toBeNull();
      expect(parser.parseAmount('99')).toBeNull();
      expect(parser.parseAmount('100001')).toBeNull();
      expect(parser.parseAmount('')).toBeNull();
      expect(parser.parseAmount('abc')).toBeNull();
    });
  });

  describe('parseBtcAddress', () => {
    it('should accept valid P2PKH address', () => {
      expect(
        parser.parseBtcAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'),
      ).toBe('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
    });

    it('should accept valid P2SH address', () => {
      expect(
        parser.parseBtcAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'),
      ).toBe('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');
    });

    it('should accept valid Bech32 address', () => {
      const addr = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
      expect(parser.parseBtcAddress(addr)).toBe(addr);
    });

    it('should reject invalid BTC addresses', () => {
      expect(parser.parseBtcAddress('not-an-address')).toBeNull();
      expect(parser.parseBtcAddress('')).toBeNull();
      expect(parser.parseBtcAddress('1234')).toBeNull();
    });
  });

  describe('parseKenyaPhone', () => {
    it('should normalize valid Kenyan numbers', () => {
      expect(parser.parseKenyaPhone('0712345678')).toBe('+254712345678');
      expect(parser.parseKenyaPhone('+254712345678')).toBe('+254712345678');
    });

    it('should reject non-Kenyan numbers', () => {
      expect(parser.parseKenyaPhone('+15551234567')).toBeNull();
      expect(parser.parseKenyaPhone('123')).toBeNull();
    });
  });

  describe('parseMpesaReference', () => {
    it('should parse valid reference', () => {
      expect(parser.parseMpesaReference('REF ABCDEF1234')).toBe('ABCDEF1234');
    });

    it('should reject too short reference', () => {
      expect(parser.parseMpesaReference('REF AB')).toBeNull();
    });

    it('should reject missing REF prefix', () => {
      expect(parser.parseMpesaReference('ABCDEF1234')).toBeNull();
    });
  });

  describe('parseFullName', () => {
    it('should parse valid full name', () => {
      expect(parser.parseFullName('John Doe')).toBe('John Doe');
      expect(parser.parseFullName('jane doe')).toBe('Jane Doe');
    });

    it('should reject single name', () => {
      expect(parser.parseFullName('John')).toBeNull();
    });

    it('should reject names with numbers', () => {
      expect(parser.parseFullName('John123')).toBeNull();
    });
  });

  describe('parseDocumentNumber', () => {
    it('should normalize document numbers', () => {
      expect(parser.parseDocumentNumber('12345678')).toBe('12345678');
      expect(parser.parseDocumentNumber('abc-def')).toBe('ABCDEF');
    });

    it('should reject too short numbers', () => {
      expect(parser.parseDocumentNumber('ab')).toBeNull();
    });
  });

  describe('parseEmail', () => {
    it('should parse valid email', () => {
      expect(parser.parseEmail('test@example.com')).toEqual({
        email: 'test@example.com',
        skipped: false,
      });
    });

    it('should handle SKIP', () => {
      expect(parser.parseEmail('SKIP')).toEqual({
        email: undefined,
        skipped: true,
      });
    });

    it('should reject invalid email', () => {
      expect(parser.parseEmail('not-email')).toEqual({
        email: undefined,
        skipped: false,
      });
    });
  });
});
