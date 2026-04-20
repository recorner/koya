import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MessagingConfigValidator implements OnModuleInit {
  private readonly logger = new Logger(MessagingConfigValidator.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');

    const whatsappEnabled =
      this.config.get<string>('MESSAGING_ENABLE_WHATSAPP_CLOUD', 'true') ===
      'true';
    const telegramEnabled =
      this.config.get<string>('MESSAGING_ENABLE_TELEGRAM', 'true') === 'true';

    if (whatsappEnabled) {
      this.require('WHATSAPP_PHONE_NUMBER_ID', nodeEnv);
      this.require('WHATSAPP_ACCESS_TOKEN', nodeEnv);
      this.require('WHATSAPP_APP_SECRET', nodeEnv);
      this.require('WHATSAPP_VERIFY_TOKEN', nodeEnv);
    }

    if (telegramEnabled) {
      this.require('TELEGRAM_BOT_TOKEN', nodeEnv);
      this.require('TELEGRAM_WEBHOOK_SECRET', nodeEnv);
    }

    this.require('WHATSAPP_WEB_BASE_URL', nodeEnv);
  }

  private require(key: string, nodeEnv: string): void {
    const value = this.config.get<string>(key, '');

    if (!value && nodeEnv === 'production') {
      throw new Error(`Missing required production messaging config: ${key}`);
    }

    if (!value) {
      this.logger.warn(`Messaging config not set: ${key}`);
    }
  }
}
