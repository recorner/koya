import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DFNSClient } from '@koya/dfns-sdk';

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

@Injectable()
export class DfnsService {
  private readonly logger = new Logger(DfnsService.name);
  private dfnsClient: DFNSClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.initClient();
  }

  private initClient(): void {
    const apiUrl = this.config.get<string>('DFNS_API_URL', '');
    const appId = this.config.get<string>('DFNS_APP_ID', '');
    const walletId = this.config.get<string>('DFNS_WALLET_ID', '');

    if (!apiUrl || !appId || !walletId) {
      this.logger.warn('DFNS SDK not configured');
      return;
    }

    const apiKey = this.config.get<string>('DFNS_API_KEY', '');

    // mTLS config
    const certPath = this.config.get<string>('DFNS_MTLS_CERT', '');
    const keyPath = this.config.get<string>('DFNS_MTLS_KEY', '');
    const caPath = this.config.get<string>('DFNS_MTLS_CA', '');

    const fs = require('fs') as typeof import('fs');
    const mTlsOptions = certPath && keyPath
      ? {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
          ca: caPath ? fs.readFileSync(caPath) : undefined,
        }
      : undefined;

    this.dfnsClient = new DFNSClient({
      baseUrl: apiUrl,
      appId,
      walletId,
      apiKey,
      mTlsOptions,
      maxRetries: 3,
      logger: {
        log: (msg) => this.logger.log(msg),
        warn: (msg) => this.logger.warn(msg),
        error: (msg) => this.logger.error(msg),
      },
    });
  }

  /**
   * Request a custody move (BTC transfer) via DFNS.
   * Persists the request in dfns_requests for tracking.
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

    if (!this.dfnsClient) {
      throw new Error('DFNS client not initialized');
    }

    const signResult = await this.dfnsClient.requestSignPsbt({
      externalId: input.externalId,
      psbtBase64: '', // Legacy path — custody move doesn't have a PSBT
      metadata: { destination: input.destination, satoshis: input.satoshis, ...(input.metadata ?? {}) },
    });

    // Persist the request
    const dbRecord = await this.prisma.dfnsRequest.create({
      data: {
        externalId: input.externalId,
        dfnsRequestId: signResult.dfnsRequestId,
        status: 'PENDING',
        rawPayload: { destination: input.destination, satoshis: input.satoshis } as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `DFNS custody move requested: dfnsRequestId=${signResult.dfnsRequestId} externalId=${input.externalId}`,
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
   * Verify DFNS webhook signature using the SDK.
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
  ): boolean {
    if (!this.dfnsClient) {
      this.logger.warn('DFNS client not initialized, rejecting webhook');
      return false;
    }

    const secret = this.config.get<string>('DFNS_WEBHOOK_SECRET', '');
    return this.dfnsClient.verifyWebhookSignature(payload, signature, secret);
  }

  /**
   * Health check: validates mTLS handshake or API connectivity.
   */
  async healthcheck(): Promise<{ ok: boolean; latencyMs: number; mTls: boolean }> {
    if (!this.dfnsClient) {
      return { ok: false, latencyMs: 0, mTls: false };
    }
    return this.dfnsClient.healthcheck();
  }
}
