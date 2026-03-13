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

@Controller('guest-conversion')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ConversionController {
  constructor(private readonly conversionService: ConversionService) {}

  /**
   * POST /api/v1/guest-conversion/quote
   */
  @Post('quote')
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
   */
  @Post('session')
  async createSession(@Body() dto: CreateSessionDto) {
    return this.conversionService.createSession({
      quoteId: dto.quoteId,
      channel: dto.channel,
    });
  }

  /**
   * POST /api/v1/guest-conversion/:sessionId/identity
   */
  @Post(':sessionId/identity')
  async submitIdentity(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitIdentityDto,
  ) {
    return this.conversionService.submitIdentity(sessionId, {
      fullName: dto.fullName,
      countryCode: dto.countryCode,
      documentType: dto.documentType as any,
      documentNumber: dto.documentNumber,
      phone: dto.phone,
      email: dto.email,
    });
  }

  /**
   * POST /api/v1/guest-conversion/:sessionId/payout-details
   */
  @Post(':sessionId/payout-details')
  async submitPayoutDetails(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitPayoutDto,
  ) {
    return this.conversionService.submitPayoutDetails(sessionId, dto.btcAddress);
  }

  /**
   * POST /api/v1/guest-conversion/:sessionId/initiate-payment
   */
  @Post(':sessionId/initiate-payment')
  async initiatePayment(@Param('sessionId') sessionId: string) {
    return this.conversionService.initiatePayment(sessionId);
  }

  /**
   * GET /api/v1/guest-conversion/:sessionId/status
   */
  @Get(':sessionId/status')
  async getStatus(@Param('sessionId') sessionId: string) {
    return this.conversionService.getStatus(sessionId);
  }
}
