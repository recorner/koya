import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Buffer } from 'node:buffer';
import { gzipSync } from 'node:zlib';

const RETENTION_DAYS = 90;

/**
 * Archives PSBT data older than 90 days.
 *
 * Flow: compress PSBT blobs → upload to S3 (KMS-encrypted) → mark DB as '[archived]'.
 */
@Injectable()
export class PsbtRetentionService {
  private readonly logger = new Logger(PsbtRetentionService.name);
  private readonly s3Client: S3Client | null;
  private readonly bucketName: string;
  private readonly kmsKeyId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.bucketName = this.config.get<string>('PSBT_ARCHIVE_S3_BUCKET', '');
    this.kmsKeyId = this.config.get<string>('PSBT_ARCHIVE_KMS_KEY_ID', '');

    if (this.bucketName) {
      this.s3Client = new S3Client({
        region: this.config.get<string>('AWS_REGION', 'us-east-1'),
      });
      this.logger.log(`S3 archival enabled: bucket=${this.bucketName}`);
    } else {
      this.s3Client = null;
      this.logger.warn('PSBT_ARCHIVE_S3_BUCKET not set — S3 archival disabled, will still mark as archived');
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'psbt-retention' })
  async archiveOldPsbts(): Promise<{ archived: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const candidates = await this.prisma.payoutPsbt.findMany({
      where: {
        updatedAt: { lt: cutoff },
        psbtStatus: { in: ['settled', 'failed'] },
      },
      select: {
        id: true,
        externalId: true,
        psbtBase64: true,
        signedPsbtBase64: true,
        updatedAt: true,
      },
    });

    if (candidates.length === 0) {
      this.logger.debug('No PSBTs eligible for archival');
      return { archived: 0 };
    }

    this.logger.log(`Archiving ${candidates.length} PSBTs older than ${RETENTION_DAYS} days`);

    let archivedCount = 0;

    for (const candidate of candidates) {
      // Upload to S3 if configured
      if (this.s3Client && this.bucketName) {
        const uploaded = await this.uploadToS3(candidate);
        if (!uploaded) {
          this.logger.error(`S3 upload failed for ${candidate.externalId} — skipping`);
          continue;
        }
      }

      // Mark as archived in DB
      await this.prisma.payoutPsbt.update({
        where: { id: candidate.id },
        data: {
          psbtBase64: '[archived]',
          signedPsbtBase64: null,
          psbtStatus: 'archived',
        },
      });

      archivedCount++;
    }

    this.logger.log(`Archived ${archivedCount} PSBTs (txid + metadata retained)`);
    return { archived: archivedCount };
  }

  private async uploadToS3(candidate: {
    externalId: string;
    psbtBase64: string;
    signedPsbtBase64: string | null;
    updatedAt: Date;
  }): Promise<boolean> {
    if (!this.s3Client) return false;

    const payload = JSON.stringify({
      externalId: candidate.externalId,
      psbtBase64: candidate.psbtBase64,
      signedPsbtBase64: candidate.signedPsbtBase64,
      archivedAt: new Date().toISOString(),
    });

    const compressed = gzipSync(Buffer.from(payload, 'utf-8'));
    const date = candidate.updatedAt;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const key = `payout_psbts/${year}/${month}/${candidate.externalId}.psbt.gz`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: compressed,
        ContentType: 'application/gzip',
        ContentEncoding: 'gzip',
        ...(this.kmsKeyId
          ? {
              ServerSideEncryption: 'aws:kms',
              SSEKMSKeyId: this.kmsKeyId,
            }
          : { ServerSideEncryption: 'AES256' }),
      });

      await this.s3Client.send(command);
      this.logger.log(`Uploaded ${key} to s3://${this.bucketName} (KMS: ${this.kmsKeyId || 'default'})`);
      return true;
    } catch (err) {
      this.logger.error(
        `S3 upload failed for ${candidate.externalId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
