import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { BtcBackendService } from './btc-backend.service';
import { CreateDepositAddressDto } from './dto/create-deposit-address.dto';

@Controller('internal/btc-backend')
@SkipThrottle()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class BtcBackendController {
  private readonly expectedApiKey: string | undefined;

  constructor(
    private readonly btcBackendService: BtcBackendService,
    private readonly config: ConfigService,
  ) {
    this.expectedApiKey =
      this.config.get<string>('ADMIN_API_KEY')
      ?? this.config.get<string>('BRIA_ADMIN_API_KEY')
      ?? this.config.get<string>('BRIA_API_KEY');
  }

  @Get('health')
  getHealth(@Headers('x-admin-api-key') apiKey?: string) {
    this.assertAuthorized(apiKey);
    return this.btcBackendService.backendHealth();
  }

  @Post('deposit-addresses')
  async issueDepositAddress(
    @Headers('x-admin-api-key') apiKey: string | undefined,
    @Body() dto: CreateDepositAddressDto,
  ) {
    this.assertAuthorized(apiKey);
    return this.btcBackendService.issueDepositAddress(dto);
  }

  @Get('deposit-addresses/:externalId')
  async getByExternalId(
    @Headers('x-admin-api-key') apiKey: string | undefined,
    @Param('externalId') externalId: string,
  ) {
    this.assertAuthorized(apiKey);
    return this.btcBackendService.getDepositAddressByExternalId(externalId);
  }

  private assertAuthorized(apiKey: string | undefined) {
    if (!this.expectedApiKey || apiKey !== this.expectedApiKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }
  }
}
