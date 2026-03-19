import { Injectable, Logger } from '@nestjs/common';
import { ConversionService } from '../conversion/conversion.service';
import { WhatsAppSessionService } from './whatsapp-session.service';
import { WhatsAppParserService, type ParsedCommand } from './whatsapp-parser.service';
import { WhatsAppTemplateService } from './whatsapp-template.service';
import type { WhatsAppConversation } from '@prisma/client';
import type { WhatsAppOutboundMessage } from '../providers/twilio-adapter.interface';

interface ConversationMetadata {
  fullName?: string;
  documentNumber?: string;
  email?: string | null;
  mpesaPhone?: string;
  pendingField?: 'MPESA_PHONE';
}

@Injectable()
export class WhatsAppFlowHandler {
  private readonly logger = new Logger(WhatsAppFlowHandler.name);

  constructor(
    private readonly conversionService: ConversionService,
    private readonly sessionSvc: WhatsAppSessionService,
    private readonly parser: WhatsAppParserService,
    private readonly templates: WhatsAppTemplateService,
  ) {}

  /**
   * Route an inbound message to the correct flow step handler
   * Returns the reply text to send back
   */
  async handle(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
  ): Promise<WhatsAppOutboundMessage> {
    const step = conversation.currentStep;

    switch (step) {
      case 'IDLE':
      case 'MENU':
        return this.handleMenu(conversation, command);
      case 'WAITING_FOR_AMOUNT':
        return this.handleAmount(conversation, command);
      case 'WAITING_FOR_QUOTE_CONFIRMATION':
        return this.handleQuoteConfirmation(conversation, command);
      case 'WAITING_FOR_FULL_NAME':
        return this.handleFullName(conversation, command);
      case 'WAITING_FOR_DOCUMENT_NUMBER':
        return this.handleDocumentNumber(conversation, command);
      case 'WAITING_FOR_EMAIL':
        return this.handleEmail(conversation, command);
      case 'WAITING_FOR_BTC_ADDRESS':
        return this.handleBtcAddress(conversation, command);
      case 'WAITING_FOR_PAYMENT_CONFIRMATION':
        return this.handlePaymentConfirmation(conversation, command);
      case 'PROCESSING':
        return this.handleProcessing(conversation, command);
      case 'COMPLETED':
        return this.handleCompleted(conversation, command);
      default:
        return this.templates.errorMessage('Something went wrong. Reply *1* to start over.');
    }
  }

  // ─── Step Handlers ────────────────────────────────────────────

  private async handleMenu(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
  ): Promise<WhatsAppOutboundMessage> {
    if (command.type === 'GREETING') {
      await this.sessionSvc.updateStep(conversation.id, 'MENU');
      return this.templates.welcomeMenu();
    }

    if (command.type === 'MENU_SELECT' && command.option === '1') {
      await this.sessionSvc.updateStep(conversation.id, 'WAITING_FOR_AMOUNT');
      return this.templates.askAmount();
    }

    if (command.type === 'MENU_SELECT' && command.option !== '1') {
      return this.templates.invalidInput(
        'That menu option is not available yet.',
        'Reply *1* to start a KES to BTC conversion.',
      );
    }

    // Show menu for any other input
    return this.templates.welcomeMenu();
  }

  private async handleAmount(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
  ): Promise<WhatsAppOutboundMessage> {
    if (command.type !== 'TEXT' && command.type !== 'MENU_SELECT') {
      return this.templates.invalidInput(
        'We need the KES amount you want to convert.',
        'Send a number between *KES 100* and *KES 100,000*, for example `2500`.',
      );
    }

    const value = command.type === 'TEXT' ? command.value : command.option;
    const amount = this.parser.parseAmount(value);
    if (!amount) {
      return this.templates.invalidInput(
        'That amount is outside the allowed range or not formatted as a number.',
        'Send an amount between *KES 100* and *KES 100,000*, for example `2500`.',
      );
    }

    try {
      const quote = await this.conversionService.createQuote({
        sourceAsset: 'KES',
        targetAsset: 'BTC',
        sourceAmount: amount,
        channel: 'WHATSAPP',
      });

      await this.sessionSvc.linkQuote(conversation.id, quote.quoteId);
      await this.sessionSvc.updateStep(
        conversation.id,
        'WAITING_FOR_QUOTE_CONFIRMATION',
      );

      return this.templates.showQuote(quote);
    } catch (error) {
      this.logger.error(`Quote creation failed: ${error}`);
      return this.renderError(
        error,
        'We could not create your quote right now.',
        'Send your KES amount again to retry.',
      );
    }
  }

  private async handleQuoteConfirmation(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
  ): Promise<WhatsAppOutboundMessage> {
    if (command.type !== 'YES') {
      return this.templates.invalidInput(
        'This step needs a quote confirmation.',
        'Reply *YES* to continue with this quote.',
      );
    }

    if (!conversation.quoteId) {
      await this.sessionSvc.updateStep(conversation.id, 'WAITING_FOR_AMOUNT');
      return this.templates.quoteExpired();
    }

    try {
      const session = await this.conversionService.createSession({
        quoteId: conversation.quoteId,
        channel: 'WHATSAPP',
      });

      await this.sessionSvc.linkSession(conversation.id, session.sessionId);
      await this.sessionSvc.updateStep(conversation.id, 'WAITING_FOR_FULL_NAME');
      await this.sessionSvc.updateMetadata(conversation.id, {});

      return this.templates.askFullName(session.referenceCode);
    } catch (error) {
      this.logger.error(`Session creation failed: ${error}`);

      // Most likely the quote expired
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('expir')
      ) {
        await this.sessionSvc.updateStep(conversation.id, 'WAITING_FOR_AMOUNT');
        return this.templates.quoteExpired();
      }

      return this.renderError(
        error,
        'We could not confirm that quote.',
        'Send a new amount to request another quote.',
      );
    }
  }

  private async handleFullName(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
  ): Promise<WhatsAppOutboundMessage> {
    if (command.type !== 'TEXT') {
      return this.templates.invalidInput(
        'We still need your full legal name.',
        'Send your first and last name exactly as shown on your ID.',
      );
    }

    const fullName = this.parser.parseFullName(command.value);
    if (!fullName) {
      return this.templates.invalidInput(
        'That name was not accepted.',
        'Send your first and last name using letters only, for example `John Doe`.',
      );
    }

    const metadata = this.getMetadata(conversation);
    metadata.fullName = fullName;
    await this.sessionSvc.updateMetadata(
      conversation.id,
      this.toMetadataRecord(metadata),
    );
    await this.sessionSvc.updateStep(
      conversation.id,
      'WAITING_FOR_DOCUMENT_NUMBER',
    );

    return this.templates.askDocumentNumber();
  }

  private async handleDocumentNumber(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
  ): Promise<WhatsAppOutboundMessage> {
    if (command.type !== 'TEXT') {
      return this.templates.invalidInput(
        'We still need your Kenyan National ID number.',
        'Send your ID number, for example `12345678`.',
      );
    }

    const docNumber = this.parser.parseDocumentNumber(command.value);
    if (!docNumber) {
      return this.templates.invalidInput(
        'That ID number was not accepted.',
        'Send a document number with 4 to 20 characters, for example `12345678`.',
      );
    }

    const metadata = this.getMetadata(conversation);
    metadata.documentNumber = docNumber;
    await this.sessionSvc.updateMetadata(
      conversation.id,
      this.toMetadataRecord(metadata),
    );
    await this.sessionSvc.updateStep(conversation.id, 'WAITING_FOR_EMAIL');

    return this.templates.askEmail();
  }

  private async handleEmail(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
  ): Promise<WhatsAppOutboundMessage> {
    const metadata = this.getMetadata(conversation);
    if (metadata.pendingField === 'MPESA_PHONE') {
      return this.handleMpesaPhoneCapture(conversation, command, metadata);
    }

    if (command.type !== 'TEXT' && command.type !== 'SKIP') {
      return this.templates.invalidInput(
        'That response does not work for the email step.',
        'Send a valid email address, or reply *SKIP* to continue without one.',
      );
    }

    const value = command.type === 'SKIP' ? 'SKIP' : command.value;

    const emailResult = this.parser.parseEmail(value);
    if (!emailResult.skipped && !emailResult.email) {
      return this.templates.invalidInput(
        'That email address does not look valid.',
        'Send a valid email like `name@example.com`, or reply *SKIP*.',
      );
    }

    metadata.email = emailResult.email ?? null;
    return this.submitIdentityWithResolvedPhone(conversation, metadata);
  }

  private async handleMpesaPhoneCapture(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
    metadata: ConversationMetadata,
  ): Promise<WhatsAppOutboundMessage> {
    if (command.type !== 'TEXT') {
      return this.templates.invalidInput(
        'We still need the Kenyan number to use for M-Pesa.',
        'Send a Kenyan mobile number like `0712345678` or `+254712345678`.',
      );
    }

    const phone = this.parser.parseKenyaPhone(command.value);
    if (!phone) {
      return this.templates.invalidKenyaPhone(command.value);
    }

    metadata.mpesaPhone = phone;
    delete metadata.pendingField;
    await this.sessionSvc.updateMetadata(
      conversation.id,
      this.toMetadataRecord(metadata),
    );

    return this.submitIdentity(conversation, metadata);
  }

  private async submitIdentityWithResolvedPhone(
    conversation: WhatsAppConversation,
    metadata: ConversationMetadata,
  ): Promise<WhatsAppOutboundMessage> {
    const fallbackPhone = this.parser.parseKenyaPhone(conversation.phoneNumber);
    if (!metadata.mpesaPhone && fallbackPhone) {
      metadata.mpesaPhone = fallbackPhone;
    }

    if (!metadata.mpesaPhone) {
      metadata.pendingField = 'MPESA_PHONE';
      await this.sessionSvc.updateMetadata(
        conversation.id,
        this.toMetadataRecord(metadata),
      );
      return this.templates.askMpesaPhone(conversation.phoneNumber);
    }

    delete metadata.pendingField;
    await this.sessionSvc.updateMetadata(
      conversation.id,
      this.toMetadataRecord(metadata),
    );
    return this.submitIdentity(conversation, metadata);
  }

  private async submitIdentity(
    conversation: WhatsAppConversation,
    metadata: ConversationMetadata,
  ): Promise<WhatsAppOutboundMessage> {
    if (!conversation.conversionSessionId) {
      return this.templates.errorMessage(
        'We could not find your active conversion session.',
        'Reply *1* to start a new conversion.',
      );
    }

    try {
      const result = await this.conversionService.submitIdentity(
        conversation.conversionSessionId,
        {
          fullName: metadata.fullName as string,
          countryCode: 'KE',
          documentType: 'NATIONAL_ID',
          documentNumber: metadata.documentNumber as string,
          phone: metadata.mpesaPhone as string,
          email: metadata.email ?? undefined,
        },
      );

      if (!result.compliancePassed) {
        await this.sessionSvc.setStatus(conversation.id, 'CANCELLED');
        return this.templates.identitySubmitted(false, result.reason);
      }

      await this.sessionSvc.updateStep(
        conversation.id,
        'WAITING_FOR_BTC_ADDRESS',
      );

      return this.templates.combine(
        this.templates.identitySubmitted(true),
        this.templates.askBtcAddress(),
      );
    } catch (error) {
      this.logger.error(`Identity submission failed: ${error}`);
      const expiryReply = this.handleOrderExpiry(conversation, error);
      if (expiryReply) return expiryReply;
      const message = error instanceof Error ? error.message : '';
      if (message.toLowerCase().includes('invalid kenya phone number')) {
        metadata.pendingField = 'MPESA_PHONE';
        await this.sessionSvc.updateMetadata(
          conversation.id,
          this.toMetadataRecord(metadata),
        );
        return this.templates.askMpesaPhone(conversation.phoneNumber);
      }

      return this.renderError(
        error,
        'We could not verify your identity details right now.',
        'Reply *START OVER* to retry the identity step.',
      );
    }
  }

  private async handleBtcAddress(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
  ): Promise<WhatsAppOutboundMessage> {
    if (command.type !== 'TEXT') {
      return this.templates.invalidInput(
        'We still need the Bitcoin address for your payout.',
        'Send a valid BTC address starting with `1`, `3`, `bc1q`, or `bc1p`.',
      );
    }

    const btcAddress = this.parser.parseBtcAddress(command.value);
    if (!btcAddress) {
      return this.templates.invalidInput(
        'That Bitcoin address was not accepted.',
        'Send a valid BTC address starting with `1`, `3`, `bc1q`, or `bc1p`.',
      );
    }

    if (!conversation.conversionSessionId) {
      return this.templates.errorMessage(
        'We could not find your active conversion session.',
        'Reply *1* to start a new conversion.',
      );
    }

    try {
      await this.conversionService.submitPayoutDetails(
        conversation.conversionSessionId,
        btcAddress,
      );

      // Get session to show payment details
      const status = await this.conversionService.getStatus(
        conversation.conversionSessionId,
      );

      await this.sessionSvc.updateStep(
        conversation.id,
        'WAITING_FOR_PAYMENT_CONFIRMATION',
      );

      const metadata = this.getMetadata(conversation);
      const paymentPhone =
        metadata.mpesaPhone ??
        this.parser.parseKenyaPhone(conversation.phoneNumber) ??
        conversation.phoneNumber;

      return this.templates.confirmPayment(
        paymentPhone,
        status.sourceAmount,
        status.referenceCode,
      );
    } catch (error) {
      this.logger.error(`Payout submission failed: ${error}`);
      return this.handleOrderExpiry(conversation, error) ??
        this.renderError(
          error,
          'We could not save that BTC address.',
          'Send a valid BTC address again to retry.',
        );
    }
  }

  private async handlePaymentConfirmation(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
  ): Promise<WhatsAppOutboundMessage> {
    if (command.type !== 'PAY') {
      return this.templates.invalidInput(
        'This step is waiting for payment confirmation.',
        'Reply *PAY* to trigger the M-Pesa STK push.',
      );
    }

    if (!conversation.conversionSessionId) {
      return this.templates.errorMessage(
        'We could not find your active conversion session.',
        'Reply *1* to start a new conversion.',
      );
    }

    try {
      const result = await this.conversionService.initiatePayment(
        conversation.conversionSessionId,
      );

      await this.sessionSvc.updateStep(conversation.id, 'PROCESSING');

      // Get referenceCode for the message
      const status = await this.conversionService.getStatus(
        conversation.conversionSessionId,
      );

      return this.templates.paymentInitiated(result.phone, status.referenceCode);
    } catch (error) {
      this.logger.error(`Payment initiation failed: ${error}`);
      return this.handleOrderExpiry(conversation, error) ??
        this.renderError(
          error,
          'We could not start the M-Pesa payment.',
          'Reply *PAY* to try again, or *STATUS* to check the current session.',
        );
    }
  }

  private async handleProcessing(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
  ): Promise<WhatsAppOutboundMessage> {
    // Allow manual M-Pesa reference while processing
    if (command.type === 'REFERENCE') {
      if (!conversation.conversionSessionId) {
        return this.templates.errorMessage(
          'We could not find your active conversion session.',
          'Reply *1* to start a new conversion.',
        );
      }

      try {
        const result = await this.conversionService.confirmByReference(
          conversation.conversionSessionId,
          command.code,
        );

        if (result.confirmed) {
          // Check if conversion completed
          const status = await this.conversionService.getStatus(
            conversation.conversionSessionId,
          );

          if (status.currentState === 'COMPLETED') {
            await this.sessionSvc.updateStep(conversation.id, 'COMPLETED');
            await this.sessionSvc.setStatus(conversation.id, 'COMPLETED');

            return this.templates.paymentSuccess({
              guestRef: status.guestRef ?? '',
              txHash: status.txHash ?? null,
              btcAmount: status.targetAmount,
              referenceCode: status.referenceCode,
            });
          }

          return this.templates.referenceAccepted();
        }

        return this.templates.referenceRejected(result.reason);
      } catch (error) {
        this.logger.error(`Reference confirmation failed: ${error}`);
        return this.renderError(
          error,
          'We could not verify that M-Pesa reference yet.',
          'Send the code again as `REF XXXXXXXXXX`, or reply *STATUS* to check progress.',
        );
      }
    }

    // STATUS check while processing
    if (command.type === 'STATUS' && conversation.conversionSessionId) {
      const status = await this.conversionService.getStatus(
        conversation.conversionSessionId,
      );
      return this.templates.conversionStatus(status);
    }

    return this.templates.invalidInput(
      'Your payment is still being processed.',
      'Send `REF XXXXXXXXXX` if you have the M-Pesa code, or reply *STATUS* to check progress.',
    );
  }

  private async handleCompleted(
    conversation: WhatsAppConversation,
    command: ParsedCommand,
  ): Promise<WhatsAppOutboundMessage> {
    // Allow starting a new conversion
    if (
      command.type === 'GREETING' ||
      (command.type === 'MENU_SELECT' && command.option === '1')
    ) {
      await this.sessionSvc.resetConversation(conversation.id);
      // Create a new conversation for the new conversion
      const newConv = await this.sessionSvc.createConversation(
        conversation.phoneNumber,
      );
      await this.sessionSvc.setStatus(conversation.id, 'COMPLETED');
      await this.sessionSvc.updateStep(newConv.id, 'WAITING_FOR_AMOUNT');
      return this.templates.askAmount();
    }

    return this.templates.welcomeMenu();
  }

  private getMetadata(
    conversation: WhatsAppConversation,
  ): ConversationMetadata {
    return ((conversation.metadata as Record<string, unknown>) ??
      {}) as ConversationMetadata;
  }

  private toMetadataRecord(
    metadata: ConversationMetadata,
  ): Record<string, unknown> {
    return metadata as Record<string, unknown>;
  }

  private renderError(
    error: unknown,
    fallbackMessage: string,
    nextStep: string,
  ): WhatsAppOutboundMessage {
    const details = this.describeError(error, fallbackMessage, nextStep);
    return this.templates.errorMessage(details.message, details.nextStep);
  }

  private describeError(
    error: unknown,
    fallbackMessage: string,
    defaultNextStep: string,
  ): { message: string; nextStep: string } {
    const rawMessage = error instanceof Error ? error.message : fallbackMessage;
    const normalized = rawMessage.toLowerCase();

    if (normalized.includes('minimum amount')) {
      return {
        message: 'The amount is below the minimum allowed for WhatsApp conversions.',
        nextStep: 'Send an amount of at least *KES 100*.',
      };
    }

    if (normalized.includes('maximum guest amount')) {
      return {
        message: 'The amount is above the current WhatsApp guest limit.',
        nextStep: 'Send an amount of *KES 100,000* or less.',
      };
    }

    if (normalized.includes('expired')) {
      return {
        message: 'That quote expired before it could be confirmed.',
        nextStep: 'Send a new KES amount to request a fresh quote.',
      };
    }

    if (normalized.includes('invalid kenya phone number')) {
      return {
        message: 'We need a valid Kenyan mobile number for M-Pesa.',
        nextStep: 'Send a Kenyan number like `0712345678` or `+254712345678`.',
      };
    }

    if (normalized.includes('invalid btc address')) {
      return {
        message: 'That Bitcoin address was not accepted.',
        nextStep: 'Send a valid address starting with `1`, `3`, `bc1q`, or `bc1p`.',
      };
    }

    if (normalized.includes('session not found')) {
      return {
        message: 'We could not find your active conversion session.',
        nextStep: 'Reply *1* to start a new conversion.',
      };
    }

    // Never leak internal errors (BigInt, DB, network) to the user
    return {
      message: fallbackMessage,
      nextStep: defaultNextStep,
    };
  }

  /**
   * Check if an error is an order expiry error.
   * If so, reset the conversation and return the orderExpired message.
   */
  private handleOrderExpiry(
    conversation: WhatsAppConversation,
    error: unknown,
  ): WhatsAppOutboundMessage | null {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('order has expired') || msg.includes('order_ttl_expired')) {
      // Reset conversation async — fire and forget for the reply
      this.sessionSvc.resetConversation(conversation.id).catch((e) =>
        this.logger.error(`Failed to reset conversation after expiry: ${e}`),
      );
      return this.templates.orderExpired();
    }
    return null;
  }
}
