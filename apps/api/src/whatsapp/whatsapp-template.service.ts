import { Injectable } from '@nestjs/common';
import type { ConversionQuoteResponse } from '@koya/types';
import type { RateSnapshot } from '../rates/rates.types';
import type {
  WhatsAppOutboundMessage,
  WhatsAppQuickReplyButton,
} from '../providers/twilio-adapter.interface';
import { WhatsAppCmsCopyService } from './whatsapp-cms-copy.service';

const DEFAULT_TEMPLATES = {
  welcome_menu: [
    '*Koya | WhatsApp Desk*',
    'Convert Kenyan shillings to Bitcoin in a few guided replies.',
    '',
    '*Menu*',
    '1. Convert KES to BTC',
    '2. Live Rates',
    '',
    'Reply *1* or *2* to choose.',
    'Reply *HELP* to see commands.',
    'Reply *CANCEL* anytime to stop.',
  ].join('\n'),
  ask_amount: [
    '*Koya | Quote Request*',
    'Send the amount you want to convert in Kenyan shillings.',
    '',
    'Allowed range: *KES 100* to *KES 100,000*',
    'Example: `2500`',
  ].join('\n'),
  show_quote: [
    '*Koya | Your Quote*',
    'Send: *KES {{source_amount}}*',
    'Receive: *BTC {{target_amount}}*',
    'Rate: *1 BTC = {{rate_display}} KES*',
    'Fee: *KES {{fee}}*',
    '',
    'This quote expires in about *30 seconds*.',
    'Reply *YES* to continue.',
  ].join('\n'),
  quote_expired: [
    '*Koya | Quote Expired*',
    'That quote is no longer valid.',
    '',
    'Next: send a new amount between *KES 100* and *KES 100,000* to get a fresh quote.',
  ].join('\n'),
  ask_full_name: [
    '*Koya | Identity Check*',
    'Your order ref: *{{reference_code}}*',
    'Save this for tracking and support.',
    '',
    'Enter your *full legal name* exactly as it appears on your ID.',
    'Example: `John Doe`',
  ].join('\n'),
  ask_document_number: [
    '*Koya | Identity Check*',
    'Enter your *Kenyan National ID number*.',
    'Example: `12345678`',
  ].join('\n'),
  ask_email: [
    '*Koya | Contact Details*',
    'Enter your email address for updates, or reply *SKIP* to continue without one.',
    'Example: `name@example.com`',
  ].join('\n'),
  ask_mpesa_phone: [
    '*Koya | Kenyan Number Needed*',
    'Your WhatsApp number *{{current_phone}}* cannot be used for this KES to BTC flow because M-Pesa requires a valid Kenyan mobile number.',
    '',
    'Send a Kenyan number in one of these formats:',
    '`0712345678`',
    '`0112345678`',
    '`254712345678`',
    '`+254712345678`',
  ].join('\n'),
  invalid_kenya_phone: [
    '*Koya | Number Not Accepted*',
    'The number *{{attempted_phone}}* is not a valid Kenyan mobile line for M-Pesa.',
    '',
    'Next: send a Kenyan number like `0712345678` or `+254712345678`.',
  ].join('\n'),
  ask_btc_address: [
    '*Koya | BTC Payout*',
    'Send the Bitcoin address where you want to receive your BTC.',
    '',
    'Accepted formats: `1...`, `3...`, `bc1q...`, `bc1p...`',
  ].join('\n'),
  confirm_payment: [
    '*Koya | Payment Check*',
    'Order: *{{reference_code}}*',
    'Amount: *KES {{amount_kes}}*',
    'M-Pesa number: *{{phone}}*',
    '',
    'Reply *PAY* to receive the M-Pesa STK push on that number.',
  ].join('\n'),
  payment_initiated: [
    '*Koya | STK Push Sent*',
    'Order: *{{reference_code}}*',
    'We sent an M-Pesa prompt to *{{phone}}*.',
    'Check your phone, enter your PIN, and complete the payment.',
    '',
    'If the prompt does not arrive, send the code as `REF XXXXXXXXXX`.',
  ].join('\n'),
  payment_success: [
    '*Koya | Conversion Complete*',
    'Reference: *{{reference_code}}*',
    'Guest ID: *{{guest_ref}}*',
    '{{btc_line}}',
    '{{tx_line}}',
    '',
    'Your BTC transfer has been queued successfully.',
    '',
    'Track your order: {{tracking_url}}',
    'Reply *1* when you want to start another conversion.',
  ].join('\n'),
  conversion_status: [
    '*Koya | Conversion Status*',
    'Reference: *{{reference_code}}*',
    'Current status: *{{current_state}}*',
    'Sending: *{{source_asset}} {{source_amount}}*',
    '{{target_line}}',
  ].join('\n'),
  help_message: [
    '*Koya | Available Commands*',
    '*1* Start a new KES to BTC conversion',
    '*2* or *RATES* View live exchange rates',
    '*STATUS* Check the progress of your active conversion',
    '*CANCEL* Stop the current conversion',
    '*START OVER* Reset the chat and begin again',
    '*HELP* Show this command list',
  ].join('\n'),
  cancel_confirmation: [
    '*Koya | Conversion Cancelled*',
    'We stopped the current flow.',
    'Reply *1* whenever you want to start a new KES to BTC conversion.',
  ].join('\n'),
  error_message: [
    '*Koya | We Need One More Step*',
    '{{message}}',
    '',
    'Next: {{next_step}}',
  ].join('\n'),
  invalid_input: [
    '*Koya | Input Not Accepted*',
    '{{message}}',
    '',
    'Next: {{next_step}}',
    'Reply *HELP* for commands or *CANCEL* to stop.',
  ].join('\n'),
  rate_limited: [
    '*Koya | Slow Down A Little*',
    'We received too many messages in a short time.',
    'Please wait a moment, then send your next reply.',
  ].join('\n'),
  session_expired: [
    '*Koya | Session Timed Out*',
    'This chat expired because there was no activity for a while.',
    'Reply *1* to start a fresh conversion.',
  ].join('\n'),
  order_expired: [
    '*Koya | Order Expired*',
    'Your conversion order has expired because payment was not completed within the time limit.',
    '',
    'Reply *1* to start a new conversion.',
  ].join('\n'),
  identity_success: [
    '*Koya | Identity Verified*',
    'Your details have been accepted and we can move to BTC payout.',
  ].join('\n'),
  identity_failed: [
    '*Koya | Identity Not Approved*',
    '{{reason}}',
    '',
    'Next: reply *START OVER* to try again, or contact support if you need help.',
  ].join('\n'),
  reference_accepted: [
    '*Koya | Reference Received*',
    'We have your M-Pesa reference and we are processing the payment now.',
    'Reply *STATUS* if you want an update.',
  ].join('\n'),
  reference_rejected: [
    '*Koya | Reference Not Accepted*',
    '{{reason}}',
    '',
    'Next: send the code as `REF XXXXXXXXXX` or reply *STATUS* to check progress.',
  ].join('\n'),
} as const;

const DEFAULT_BUTTONS: Partial<
  Record<keyof typeof DEFAULT_TEMPLATES, WhatsAppQuickReplyButton[]>
> = {
  welcome_menu: [
    { id: '1', title: 'Convert KES to BTC' },
    { id: '2', title: 'Live Rates' },
    { id: 'HELP', title: 'Help' },
  ],
  show_quote: [
    { id: 'YES', title: 'Continue' },
    { id: 'CANCEL', title: 'Cancel' },
  ],
  ask_email: [{ id: 'SKIP', title: 'Skip Email' }],
  confirm_payment: [
    { id: 'PAY', title: 'Send STK Push' },
    { id: 'CANCEL', title: 'Cancel' },
  ],
  payment_initiated: [{ id: 'STATUS', title: 'Check Status' }],
  payment_success: [{ id: '1', title: 'New Conversion' }],
  session_expired: [{ id: '1', title: 'Start Again' }],
  order_expired: [{ id: '1', title: 'Start Again' }],
  cancel_confirmation: [{ id: '1', title: 'Start Again' }],
  identity_failed: [{ id: 'START OVER', title: 'Start Over' }],
  reference_accepted: [{ id: 'STATUS', title: 'Check Status' }],
};

@Injectable()
export class WhatsAppTemplateService {
  private readonly webBaseUrl: string;

  constructor(private readonly cmsCopy?: WhatsAppCmsCopyService) {
    this.webBaseUrl = process.env['WHATSAPP_WEB_BASE_URL'] ?? 'https://koyabank.com';
  }

  welcomeMenu(): WhatsAppOutboundMessage {
    return this.buildMessage('welcome_menu');
  }

  askAmount(): WhatsAppOutboundMessage {
    return this.buildMessage('ask_amount');
  }

  showQuote(quote: ConversionQuoteResponse): WhatsAppOutboundMessage {
    // Invert KES/BTC rate to BTC/KES for readability
    // e.g. 0.000000111 → "8,977,127"
    const rateNum = parseFloat(quote.rate);
    const inverseRate = rateNum > 0 ? (1 / rateNum) : 0;
    const rateDisplay = inverseRate.toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });

    return this.buildMessage('show_quote', {
      source_amount: quote.sourceAmount,
      target_amount: quote.targetAmount,
      rate_display: rateDisplay,
      fee: quote.fee,
    });
  }

  quoteExpired(): WhatsAppOutboundMessage {
    return this.buildMessage('quote_expired');
  }

  askFullName(referenceCode: string): WhatsAppOutboundMessage {
    return this.buildMessage('ask_full_name', {
      reference_code: referenceCode,
    });
  }

  askDocumentNumber(): WhatsAppOutboundMessage {
    return this.buildMessage('ask_document_number');
  }

  askEmail(): WhatsAppOutboundMessage {
    return this.buildMessage('ask_email');
  }

  askMpesaPhone(currentPhone: string): WhatsAppOutboundMessage {
    return this.buildMessage('ask_mpesa_phone', {
      current_phone: currentPhone,
    });
  }

  invalidKenyaPhone(attemptedPhone: string): WhatsAppOutboundMessage {
    return this.buildMessage('invalid_kenya_phone', {
      attempted_phone: attemptedPhone,
    });
  }

  askBtcAddress(): WhatsAppOutboundMessage {
    return this.buildMessage('ask_btc_address');
  }

  confirmPayment(phone: string, amountKes: string, referenceCode: string): WhatsAppOutboundMessage {
    const maskedPhone = this.maskPhone(phone);
    return this.buildMessage('confirm_payment', {
      amount_kes: amountKes,
      phone: maskedPhone,
      reference_code: referenceCode,
    });
  }

  paymentInitiated(phone: string, referenceCode: string): WhatsAppOutboundMessage {
    const maskedPhone = this.maskPhone(phone);
    return this.buildMessage('payment_initiated', {
      phone: maskedPhone,
      reference_code: referenceCode,
    });
  }

  paymentSuccess(data: {
    guestRef: string;
    txHash: string | null;
    btcAmount: string | null;
    referenceCode: string;
  }): WhatsAppOutboundMessage {
    return this.buildMessage('payment_success', {
      reference_code: data.referenceCode,
      guest_ref: data.guestRef,
      btc_line: data.btcAmount ? `BTC received: *${data.btcAmount}*` : '',
      tx_line: data.txHash ? `Transaction: *${this.maskTxHash(data.txHash)}*` : '',
      tracking_url: this.getTrackingUrl(data.referenceCode),
    });
  }

  conversionStatus(status: {
    currentState: string;
    referenceCode: string;
    sourceAmount: string;
    sourceAsset: string;
    targetAmount: string | null;
    targetAsset: string;
  }): WhatsAppOutboundMessage {
    return this.buildMessage('conversion_status', {
      reference_code: status.referenceCode,
      current_state: this.humanizeState(status.currentState),
      source_asset: status.sourceAsset,
      source_amount: status.sourceAmount,
      target_line: status.targetAmount
        ? `Expected payout: *${status.targetAsset} ${status.targetAmount}*`
        : '',
    });
  }

  helpMessage(): WhatsAppOutboundMessage {
    return this.buildMessage('help_message');
  }

  showRates(rates: RateSnapshot[]): WhatsAppOutboundMessage {
    const DISPLAY_PAIRS: Record<string, (mid: number) => string> = {
      'BTC/KES': (m) => `1 BTC = *KES ${Math.round(m).toLocaleString('en-US')}*`,
      'BTC/USD': (m) => `1 BTC = *$${m.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*`,
      'USDT/KES': (m) => `1 USDT = *KES ${m.toFixed(2)}*`,
      'USDC/KES': (m) => `1 USDC = *KES ${m.toFixed(2)}*`,
      'KES/USD': (m) => `1 USD = *KES ${(1 / m).toFixed(2)}*`,
    };

    const lines: string[] = ['*Koya | Live Rates*', ''];
    for (const [pair, formatter] of Object.entries(DISPLAY_PAIRS)) {
      const snapshot = rates.find((r) => r.pair === pair);
      if (snapshot) {
        const staleTag = snapshot.stale ? ' ⚠️' : '';
        lines.push(`${formatter(snapshot.mid)}${staleTag}`);
      }
    }
    lines.push('', 'Rates update every few seconds.');
    lines.push('Reply *1* to convert KES to BTC.');

    return { body: lines.join('\n') };
  }

  cancelConfirmation(): WhatsAppOutboundMessage {
    return this.buildMessage('cancel_confirmation');
  }

  errorMessage(msg: string, nextStep?: string): WhatsAppOutboundMessage {
    return this.buildMessage('error_message', {
      message: msg,
      next_step:
        nextStep ??
        'reply *HELP* for commands or *START OVER* to restart the conversation',
    });
  }

  invalidInput(
    message: string,
    nextStep: string,
  ): WhatsAppOutboundMessage {
    return this.buildMessage('invalid_input', {
      message,
      next_step: nextStep,
    });
  }

  rateLimited(): WhatsAppOutboundMessage {
    return this.buildMessage('rate_limited');
  }

  sessionExpired(): WhatsAppOutboundMessage {
    return this.buildMessage('session_expired');
  }

  orderExpired(): WhatsAppOutboundMessage {
    return this.buildMessage('order_expired');
  }

  identitySubmitted(
    compliancePassed: boolean,
    reason?: string,
  ): WhatsAppOutboundMessage {
    if (compliancePassed) {
      return this.buildMessage('identity_success');
    }
    return this.buildMessage('identity_failed', {
      reason:
        reason ??
        'Your identity details were not approved for this transaction.',
    });
  }

  referenceAccepted(): WhatsAppOutboundMessage {
    return this.buildMessage('reference_accepted');
  }

  referenceRejected(reason?: string): WhatsAppOutboundMessage {
    return this.buildMessage('reference_rejected', {
      reason: reason ?? 'We could not match that M-Pesa reference yet.',
    });
  }

  combine(
    ...messages: Array<WhatsAppOutboundMessage | null | undefined>
  ): WhatsAppOutboundMessage {
    const bodies = messages
      .map((message) => message?.body?.trim())
      .filter((body): body is string => Boolean(body));

    return { body: bodies.join('\n\n').trim() };
  }

  // ─── Masking Helpers ─────────────────────────────────────────────

  getTrackingUrl(referenceCode: string): string {
    return `${this.webBaseUrl}/convert?ref=${encodeURIComponent(referenceCode)}`;
  }

  maskPhone(phone: string): string {
    if (phone.length <= 4) return phone;
    return '*'.repeat(phone.length - 4) + phone.slice(-4);
  }

  maskDocumentNumber(docNumber: string): string {
    if (docNumber.length <= 4) return docNumber;
    return '*'.repeat(docNumber.length - 4) + docNumber.slice(-4);
  }

  maskBtcAddress(address: string): string {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private maskTxHash(hash: string): string {
    if (hash.length <= 12) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
  }

  private buildMessage(
    key: keyof typeof DEFAULT_TEMPLATES,
    tokens: Record<string, string | number | null | undefined> = {},
  ): WhatsAppOutboundMessage {
    const fallbackBody = DEFAULT_TEMPLATES[key];
    const fallbackButtons = DEFAULT_BUTTONS[key];
    const template = this.cmsCopy?.getTemplate(key);
    const bodyTemplate = template?.body ?? fallbackBody;
    const renderedBody = this.localRender(bodyTemplate, tokens);
    const buttons = template
      ? template.buttons === null
        ? fallbackButtons
        : template.buttons
      : fallbackButtons;

    if (!buttons || buttons.length === 0) {
      return { body: renderedBody };
    }

    return {
      body: renderedBody,
      variables: this.toStringVariables(tokens),
      interactive: {
        templateKey: key,
        cmsItemId: template?.id ?? null,
        bodyTemplate,
        buttons,
        contentSid: template?.twilioContentSid ?? null,
        contentSignature: template?.twilioContentHash ?? null,
      },
    };
  }

  private localRender(
    template: string,
    tokens: Record<string, string | number | null | undefined>,
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(tokens)) {
      const safeValue = value == null ? '' : String(value);
      result = result.replace(
        new RegExp(`{{\\s*${key}\\s*}}`, 'g'),
        safeValue,
      );
    }

    return result.replace(/\n{3,}/g, '\n\n').trim();
  }

  private toStringVariables(
    tokens: Record<string, string | number | null | undefined>,
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(tokens)
        .filter(([, value]) => value != null && String(value).length > 0)
        .map(([key, value]) => [key, String(value)]),
    );
  }

  private humanizeState(state: string): string {
    return state
      .toLowerCase()
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }
}
