import { Injectable } from '@nestjs/common';
import {
  InvalidPhoneError,
  isValidBtcAddress,
  normalizeKenyaPhone,
  normalizeDocumentNumber,
} from '../common/validation.utils';

export type ParsedCommand =
  | { type: 'GREETING' }
  | { type: 'MENU_SELECT'; option: string }
  | { type: 'HELP' }
  | { type: 'CANCEL' }
  | { type: 'START_OVER' }
  | { type: 'STATUS' }
  | { type: 'RATES' }
  | { type: 'YES' }
  | { type: 'PAY' }
  | { type: 'SKIP' }
  | { type: 'REFERENCE'; code: string }
  | { type: 'TEXT'; value: string };

@Injectable()
export class WhatsAppParserService {
  /**
   * Parse a raw inbound message into a typed command
   */
  parseCommand(input: {
    body: string;
    buttonText?: string;
    buttonPayload?: string;
  }): ParsedCommand {
    const payloadCommand = this.parseCommandText(input.buttonPayload);
    if (payloadCommand && payloadCommand.type !== 'TEXT') {
      return payloadCommand;
    }

    const textCommand = this.parseCommandText(input.buttonText);
    if (textCommand && textCommand.type !== 'TEXT') {
      return textCommand;
    }

    return (
      payloadCommand ??
      textCommand ??
      this.parseCommandText(input.body) ?? { type: 'TEXT', value: '' }
    );
  }

  private parseCommandText(value: string | undefined): ParsedCommand | null {
    if (!value) {
      return null;
    }

    const body = value.trim();
    if (!body) {
      return null;
    }

    const trimmed = body;
    const upper = trimmed.toUpperCase();

    // Global commands
    if (upper === 'HELP') return { type: 'HELP' };
    if (upper === 'CANCEL') return { type: 'CANCEL' };
    if (upper === 'START OVER') return { type: 'START_OVER' };
    if (upper === 'STATUS') return { type: 'STATUS' };
    if (upper === 'RATES' || upper === 'RATE' || upper === 'PRICES') return { type: 'RATES' };
    if (upper === 'YES') return { type: 'YES' };
    if (upper === 'PAY') return { type: 'PAY' };
    if (upper === 'SKIP') return { type: 'SKIP' };

    // Greetings
    if (/^(hi|hello|hey|start)$/i.test(trimmed)) {
      return { type: 'GREETING' };
    }

    // Menu selection (single digit)
    if (/^\d$/.test(trimmed)) {
      return { type: 'MENU_SELECT', option: trimmed };
    }

    // Manual M-Pesa reference: "REF XXXXXXX"
    const refMatch = trimmed.match(/^REF\s+(.{6,20})$/i);
    if (refMatch && refMatch[1]) {
      return { type: 'REFERENCE', code: refMatch[1].trim().toUpperCase() };
    }

    return { type: 'TEXT', value: trimmed };
  }

  /**
   * Parse and validate a KES amount from user text
   * Returns amount in KES major units as a string, or null if invalid
   */
  parseAmount(body: string): string | null {
    const cleaned = body.trim().replace(/,/g, '').replace(/KES\s*/i, '');
    const match = cleaned.match(/^(\d+(?:\.\d{1,2})?)$/);
    if (!match || !match[1]) return null;

    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount < 100 || amount > 100_000) return null;

    return match[1];
  }

  /**
   * Parse and validate a BTC address
   */
  parseBtcAddress(body: string): string | null {
    const trimmed = body.trim();
    return isValidBtcAddress(trimmed) ? trimmed : null;
  }

  /**
   * Parse and normalize a Kenyan mobile number to E.164
   */
  parseKenyaPhone(body: string): string | null {
    try {
      return normalizeKenyaPhone(body.trim());
    } catch (error) {
      if (error instanceof InvalidPhoneError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Parse M-Pesa reference from "REF xxx" format
   */
  parseMpesaReference(body: string): string | null {
    const match = body.trim().match(/^REF\s+(.{6,20})$/i);
    return match && match[1] ? match[1].trim().toUpperCase() : null;
  }

  /**
   * Parse a full name (at least two words, letters only)
   */
  parseFullName(body: string): string | null {
    const trimmed = body.trim();
    // At least 2 characters, allows letters, spaces, hyphens, apostrophes
    if (trimmed.length < 2 || trimmed.length > 100) return null;
    if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) return null;
    // Must have at least first and last name
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  }

  /**
   * Parse and normalize a document number
   */
  parseDocumentNumber(body: string): string | null {
    const trimmed = body.trim();
    if (trimmed.length < 4 || trimmed.length > 20) return null;
    return normalizeDocumentNumber(trimmed);
  }

  /**
   * Parse an email or accept SKIP
   */
  parseEmail(body: string): { email: string | undefined; skipped: boolean } {
    const trimmed = body.trim();
    if (trimmed.toUpperCase() === 'SKIP') {
      return { email: undefined, skipped: true };
    }
    // Basic email regex
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { email: trimmed.toLowerCase(), skipped: false };
    }
    return { email: undefined, skipped: false };
  }
}
