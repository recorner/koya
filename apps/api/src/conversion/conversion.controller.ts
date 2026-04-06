import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConversionService } from './conversion.service';
import { QuoteRequestDto } from './dto/quote-request.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { SubmitIdentityDto } from './dto/submit-identity.dto';
import { SubmitPayoutDto } from './dto/submit-payout.dto';
import { ConfirmReferenceDto } from './dto/confirm-reference.dto';
import {
  QuoteThrottle,
  StatusThrottle,
  SubmitThrottle,
  PaymentThrottle,
} from '../security/throttle.decorators';

@Controller('guest-conversion')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ConversionController {
  constructor(private readonly conversionService: ConversionService) {}

  /**
   * POST /api/v1/guest-conversion/quote
   * Rate limit: 20 req/min/IP
   */
  @Post('quote')
  @QuoteThrottle()
  async createQuote(@Body() dto: QuoteRequestDto) {
    return this.conversionService.createQuote({
      sourceAsset: dto.sourceAsset,
      targetAsset: dto.targetAsset,
      sourceAmount: dto.sourceAmount,
      channel: dto.channel,
    });
  }

  /**
   * POST /api/v1/guest-conversion/session
   * Rate limit: 20 req/min/IP
   */
  @Post('session')
  @QuoteThrottle()
  async createSession(@Body() dto: CreateSessionDto) {
    return this.conversionService.createSession({
      quoteId: dto.quoteId,
      channel: dto.channel,
    });
  }

  /**
   * POST /api/v1/guest-conversion/:sessionId/identity
   * Rate limit: 10 req/min/IP
   */
  @Post(':sessionId/identity')
  @SubmitThrottle()
  async submitIdentity(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitIdentityDto,
  ) {
    return this.conversionService.submitIdentity(sessionId, {
      fullName: dto.fullName,
      countryCode: dto.countryCode,
      documentType: dto.documentType as 'NATIONAL_ID' | 'PASSPORT' | 'ALIEN_ID' | 'MILITARY_ID',
      documentNumber: dto.documentNumber,
      phone: dto.phone,
      email: dto.email,
    });
  }

  /**
   * POST /api/v1/guest-conversion/:sessionId/payout-details
   * Rate limit: 10 req/min/IP
   */
  @Post(':sessionId/payout-details')
  @SubmitThrottle()
  async submitPayoutDetails(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitPayoutDto,
  ) {
    return this.conversionService.submitPayoutDetails(sessionId, dto.btcAddress);
  }

  /**
   * POST /api/v1/guest-conversion/:sessionId/initiate-payment
   * Rate limit: 10 req/min/IP
   */
  @Post(':sessionId/initiate-payment')
  @PaymentThrottle()
  async initiatePayment(@Param('sessionId') sessionId: string) {
    return this.conversionService.initiatePayment(sessionId);
  }

  /**
   * POST /api/v1/guest-conversion/:sessionId/confirm-reference
   * Rate limit: 10 req/min/IP
   */
  @Post(':sessionId/confirm-reference')
  @PaymentThrottle()
  async confirmReference(
    @Param('sessionId') sessionId: string,
    @Body() dto: ConfirmReferenceDto,
  ) {
    return this.conversionService.confirmByReference(sessionId, dto.mpesaReference);
  }

  /**
   * GET /api/v1/guest-conversion/:sessionId/status
   * Rate limit: 60 req/min/IP
   */
  @Get(':sessionId/status')
  @StatusThrottle()
  async getStatus(@Param('sessionId') sessionId: string) {
    return this.conversionService.getStatus(sessionId);
  }

  /**
   * GET /api/v1/guest-conversion/by-reference/:referenceCode/status
   * Look up order status by user-facing reference code (KYA-XXXX)
   * Rate limit: 60 req/min/IP
   */
  @Get('by-reference/:referenceCode/status')
  @StatusThrottle()
  async getStatusByReference(@Param('referenceCode') referenceCode: string) {
    return this.conversionService.getStatusByReference(referenceCode);
  }
}
