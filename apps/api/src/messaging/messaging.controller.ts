import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { WebhookThrottle } from '../security/throttle.decorators';
import { MessagingOrchestratorService } from './messaging-orchestrator.service';
import { WebhookSignatureError } from './messaging.errors';

@Controller('messaging/webhooks')
@WebhookThrottle()
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(private readonly orchestrator: MessagingOrchestratorService) {}

  @Get('whatsapp-cloud')
  async verifyWhatsAppChallenge(
    @Query() query: Record<string, string | string[] | undefined>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.orchestrator.handleWebhook({
        provider: 'WHATSAPP_CLOUD',
        headers,
        payload: {},
        rawBody: '',
        query,
        correlationId: this.correlationId(req),
      });

      if (!result.accepted || !result.challenge) {
        res.status(403).send('Forbidden');
        return;
      }

      res.status(200).send(result.challenge);
    } catch (error) {
      this.logger.warn('WhatsApp challenge verification failed');
      res.status(403).send('Forbidden');
    }
  }

  @Post('whatsapp-cloud')
  @HttpCode(200)
  async handleWhatsAppWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request,
  ): Promise<{ status: string }> {
    try {
      await this.orchestrator.handleWebhook({
        provider: 'WHATSAPP_CLOUD',
        headers,
        payload,
        rawBody: this.rawBody(req, payload),
        correlationId: this.correlationId(req),
      });
      return { status: 'accepted' };
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  @Post('telegram')
  @HttpCode(200)
  async handleTelegramWebhook(
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request,
  ): Promise<{ status: string }> {
    try {
      await this.orchestrator.handleWebhook({
        provider: 'TELEGRAM',
        headers,
        payload,
        rawBody: this.rawBody(req, payload),
        correlationId: this.correlationId(req),
      });
      return { status: 'accepted' };
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }

  private correlationId(req: Request): string {
    return (req.headers['x-request-id'] as string) ?? 'unknown';
  }

  private rawBody(req: Request, fallbackPayload: Record<string, unknown>): string {
    const maybeRaw = (req as Request & { rawBody?: Buffer | string }).rawBody;
    if (Buffer.isBuffer(maybeRaw)) {
      return maybeRaw.toString('utf8');
    }
    if (typeof maybeRaw === 'string') {
      return maybeRaw;
    }
    return JSON.stringify(fallbackPayload ?? {});
  }
}
