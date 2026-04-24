import {
  Controller,
  Post,
  Body,
  Headers,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BriaSetupService } from './bria-setup.service';

@Controller('admin/bria')
export class BriaSetupController {
  private readonly logger = new Logger(BriaSetupController.name);
  private readonly adminApiKey: string | undefined;
  private readonly environment: string;
  private readonly setupEnabled: boolean;

  constructor(
    private readonly briaSetup: BriaSetupService,
    private readonly config: ConfigService,
  ) {
    this.adminApiKey = this.config.get<string>('ADMIN_API_KEY');
    this.environment = (this.config.get<string>('ENVIRONMENT') ?? '').toLowerCase();
    this.setupEnabled = (this.config.get<string>('BRIA_SETUP_ENABLED') ?? '').toLowerCase() === 'true';
  }

  @Post('setup')
  async setup(
    @Headers('x-admin-api-key') apiKey: string,
    @Body() body: { xpub?: string; derivation?: string },
  ) {
    if (this.environment === 'production' && !this.setupEnabled) {
      throw new ForbiddenException(
        'Bria setup endpoint is disabled in production. Set BRIA_SETUP_ENABLED=true for controlled operations.',
      );
    }

    if (!this.adminApiKey || apiKey !== this.adminApiKey) {
      throw new UnauthorizedException('Invalid admin API key');
    }

    this.logger.log('Running Bria setup...');
    const results = await this.briaSetup.runFullSetup(body.xpub);
    return { success: true, results };
  }
}
