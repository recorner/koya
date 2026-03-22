import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface DfnsCustodyMoveInput {
  externalId: string;
  destination: string;
  satoshis: number;
  metadata?: Record<string, unknown>;
}

export interface DfnsCustodyMoveResult {
  dfnsRequestId: string;
  status: string;
}

interface DfnsTransferResponse {
  id: string;
  status: string;
  txHash?: string;
}

@Injectable()
export class DfnsService {
  private readonly logger = new Logger(DfnsService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly appId: string;
  private readonly walletId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiUrl = this.config.get<string>(
      'DFNS_API_URL',
      'https://api.dfns.ninja/v2',
    );
    this.apiKey = this.config.get<string>('DFNS_API_KEY', '');
    this.appId = this.config.get<string>('DFNS_APP_ID', '');
    this.walletId = this.config.get<string>('DFNS_WALLET_ID', '');
  }

  /**
   * Request a custody move (BTC transfer) via DFNS.
   * Persists the request in dfns_requests for tracking.
   * Includes retry for transient HTTP errors.
   */
  async requestCustodyMove(
    input: DfnsCustodyMoveInput,
  ): Promise<DfnsCustodyMoveResult> {
    // Check for existing request with same externalId (idempotency)
    const existing = await this.prisma.dfnsRequest.findUnique({
      where: { externalId: input.externalId },
    });

    if (existing) {
      this.logger.log(
        `DFNS request already exists for externalId=${input.externalId}, returning existing`,
      );
      return {
        dfnsRequestId: existing.dfnsRequestId ?? existing.id,
        status: existing.status,
      };
    }

    const callbackUrl = this.config.get<string>(
      'DFNS_WEBHOOK_URL',
      'https://api.koyabank.com/api/v1/dfns/webhook',
    );

    const body = {
      walletId: this.walletId,
      to: input.destination,
      amount: String(input.satoshis),
      asset: 'BTC',
      externalId: input.externalId,
      callbackUrl,
      metadata: input.metadata,
    };

    const response = await this.callWithRetry(
      `${this.apiUrl}/wallets/${this.walletId}/transfers`,
      body,
    );

    // Persist the request
    const dbRecord = await this.prisma.dfnsRequest.create({
      data: {
        externalId: input.externalId,
        dfnsRequestId: response.id,
        status: response.status || 'PENDING',
        rawPayload: body as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `DFNS custody move requested: dfnsRequestId=${response.id} externalId=${input.externalId}`,
    );

    return {
      dfnsRequestId: dbRecord.dfnsRequestId ?? dbRecord.id,
      status: dbRecord.status,
    };
  }

  /**
   * Look up a DFNS request by externalId.
   */
  async getRequestByExternalId(externalId: string) {
    return this.prisma.dfnsRequest.findUnique({
      where: { externalId },
    });
  }

  /**
   * Update a DFNS request after webhook callback.
   */
  async updateRequestStatus(
    externalId: string,
    status: string,
    dfnsTxId?: string,
  ) {
    return this.prisma.dfnsRequest.update({
      where: { externalId },
      data: {
        status,
        ...(dfnsTxId ? { dfnsTxId } : {}),
      },
    });
  }

  /**
   * Verify DFNS webhook signature.
   * DFNS signs webhooks with HMAC-SHA256 using the webhook secret.
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
  ): boolean {
    const secret = this.config.get<string>('DFNS_WEBHOOK_SECRET', '');
    if (!secret) {
      this.logger.warn('DFNS_WEBHOOK_SECRET not configured, rejecting webhook');
      return false;
    }

    // Use Node.js crypto for HMAC verification
    const crypto = require('crypto') as typeof import('crypto');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      return false;
    }
  }

  private async callWithRetry(
    url: string,
    body: Record<string, unknown>,
    maxRetries = 3,
  ): Promise<DfnsTransferResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            ...(this.appId ? { 'X-DFNS-APPID': this.appId } : {}),
          },
          body: JSON.stringify(body),
        });

        if (response.status === 409) {
          // ALREADY_EXISTS — idempotent, return the existing resource
          const data = (await response.json()) as DfnsTransferResponse;
          this.logger.log(`DFNS returned 409 (already exists) for externalId`);
          return data;
        }

        if (response.ok) {
          return (await response.json()) as DfnsTransferResponse;
        }

        const statusCode = response.status;
        const errorText = await response.text();

        // Transient errors: retry
        if (statusCode >= 500 || statusCode === 429) {
          lastError = new Error(
            `DFNS API error: ${statusCode} ${errorText}`,
          );
          this.logger.warn(
            `DFNS transient error (attempt ${attempt}/${maxRetries}): ${statusCode}`,
          );
          // Exponential backoff: 1s, 2s, 4s
          await this.sleep(Math.pow(2, attempt - 1) * 1000);
          continue;
        }

        // Permanent error — don't retry
        throw new Error(`DFNS API error: ${statusCode} ${errorText}`);
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.startsWith('DFNS API error:')
        ) {
          throw err;
        }
        // Network error — retry
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `DFNS network error (attempt ${attempt}/${maxRetries}): ${lastError.message}`,
        );
        if (attempt < maxRetries) {
          await this.sleep(Math.pow(2, attempt - 1) * 1000);
        }
      }
    }

    throw lastError ?? new Error('DFNS API call failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
