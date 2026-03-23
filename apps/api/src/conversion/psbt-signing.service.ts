import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BriaClientService } from '@koya/bria-adapter';
import { DFNSClient } from '@koya/dfns-sdk';

/**
 * PsbtSigningService orchestrates the Bria → DFNS → Bria PSBT signing flow:
 *
 * 1. getBatch(batchId)     → retrieve unsigned PSBT from Bria
 * 2. persist PayoutPsbt    → store metadata in Koya DB
 * 3. requestSignPsbt(...)  → send to DFNS for signing (with idempotency)
 * 4. submitSignedPsbt(...) → return signed PSBT to Bria for broadcast
 */
@Injectable()
export class PsbtSigningService {
  private readonly logger = new Logger(PsbtSigningService.name);
  private dfnsClient: DFNSClient | null = null;
  private readonly xpubRef: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly briaClient: BriaClientService,
    private readonly config: ConfigService,
  ) {
    this.xpubRef = this.config.get<string>('BRIA_XPUB_REF', 'default');
    this.initDfnsClient();
  }

  private initDfnsClient(): void {
    const apiUrl = this.config.get<string>('DFNS_API_URL', '');
    const appId = this.config.get<string>('DFNS_APP_ID', '');
    const walletId = this.config.get<string>('DFNS_WALLET_ID', '');

    if (!apiUrl || !appId || !walletId) {
      this.logger.warn('DFNS SDK not configured — PSBT signing will be unavailable');
      return;
    }

    const apiKey = this.config.get<string>('DFNS_API_KEY', '');

    // mTLS config from env (PEM files loaded from paths or inline)
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
      maxRetries: 5,
      timeoutMs: 15_000,
      logger: {
        log: (msg) => this.logger.log(msg),
        warn: (msg) => this.logger.warn(msg),
        error: (msg) => this.logger.error(msg),
      },
    });

    this.logger.log(`DFNS SDK initialized: ${apiUrl} (mTLS: ${mTlsOptions ? 'enabled' : 'disabled'})`);
  }

  /**
   * Handle a payout_committed event by retrieving the unsigned PSBT,
   * sending it to DFNS for signing, and submitting the signed PSBT back to Bria.
   */
  async handlePayoutCommitted(
    payoutId: string,
    externalId: string,
    batchId: string,
  ): Promise<void> {
    if (!this.dfnsClient) {
      this.logger.warn('DFNS client not initialized — skipping PSBT signing');
      return;
    }

    // Idempotency: check if we already have a record for this externalId
    const existing = await this.prisma.payoutPsbt.findUnique({
      where: { externalId },
    });

    if (existing && (existing.psbtStatus === 'signed' || existing.psbtStatus === 'broadcast')) {
      this.logger.log(`PSBT already processed for ${externalId}, status=${existing.psbtStatus}`);
      return;
    }

    // Step 1: Get unsigned PSBT from Bria
    const batch = await this.briaClient.getBatch(batchId);
    if (!batch.unsignedPsbt) {
      this.logger.error(`No unsigned PSBT in batch ${batchId}`);
      return;
    }

    this.logger.log(`Got unsigned PSBT from Bria batch ${batchId} for ${externalId}`);

    // Step 2: Persist PSBT metadata
    const psbtRecord = existing
      ? await this.prisma.payoutPsbt.update({
          where: { externalId },
          data: { psbtBase64: batch.unsignedPsbt, psbtId: batchId, psbtStatus: 'signing_pending' },
        })
      : await this.prisma.payoutPsbt.create({
          data: {
            externalId,
            psbtBase64: batch.unsignedPsbt,
            psbtId: batchId,
            psbtStatus: 'signing_pending',
          },
        });

    // Step 3: Send to DFNS for signing
    try {
      const signResult = await this.dfnsClient.requestSignPsbt({
        externalId,
        psbtBase64: batch.unsignedPsbt,
        psbtId: batchId,
        metadata: { payoutId, koyaRef: externalId },
      });

      this.logger.log(
        `DFNS signed PSBT: dfnsRequestId=${signResult.dfnsRequestId} alreadyExists=${signResult.alreadyExists ?? false}`,
      );

      // Step 4: Update record with signed PSBT
      await this.prisma.payoutPsbt.update({
        where: { id: psbtRecord.id },
        data: {
          signedPsbtBase64: signResult.signedPsbtBase64,
          dfnsRequestId: signResult.dfnsRequestId,
          psbtStatus: 'signed',
        },
      });

      // Step 5: Submit signed PSBT back to Bria
      await this.briaClient.submitSignedPsbt({
        batchId,
        xpubRef: this.xpubRef,
        signedPsbt: signResult.signedPsbtBase64,
      });

      await this.prisma.payoutPsbt.update({
        where: { id: psbtRecord.id },
        data: { psbtStatus: 'broadcast' },
      });

      this.logger.log(`Signed PSBT submitted to Bria for broadcast: batch=${batchId} external=${externalId}`);
    } catch (err) {
      this.logger.error(
        `PSBT signing failed for ${externalId}: ${err instanceof Error ? err.message : String(err)}`,
      );

      await this.prisma.payoutPsbt.update({
        where: { id: psbtRecord.id },
        data: { psbtStatus: 'failed' },
      });

      throw err;
    }
  }

  /**
   * Update a PayoutPsbt record when the transaction is settled.
   */
  async markSettled(externalId: string, txid: string): Promise<void> {
    const record = await this.prisma.payoutPsbt.findUnique({
      where: { externalId },
    });

    if (record) {
      await this.prisma.payoutPsbt.update({
        where: { id: record.id },
        data: { psbtStatus: 'settled', txid },
      });
    }
  }
}
