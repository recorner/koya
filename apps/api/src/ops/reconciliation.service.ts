import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BriaClientService } from '@koya/bria-adapter';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

export interface ReconciliationResult {
  date: string;
  totalPayouts: number;
  matched: number;
  mismatches: ReconciliationMismatch[];
  absDeltaSats: number;
}

export interface ReconciliationMismatch {
  externalId: string;
  koyaSats: bigint;
  briaSats: number;
  deltaSats: number;
  reason: string;
}

/**
 * Daily reconciliation job comparing Koya PayoutInstruction records
 * against confirmed Bria payouts for the previous 24 hours.
 *
 * Alerting thresholds:
 * - absDeltaSats > 0  → WARNING
 * - absDeltaSats > 1000 → CRITICAL (escalate immediately)
 *
 * TODO: Publish CloudWatch metric and send SNS notification.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private readonly cwClient: CloudWatchClient | null;
  private readonly environment: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly briaClient: BriaClientService,
    private readonly config: ConfigService,
  ) {
    this.environment = this.config.get<string>('NODE_ENV', 'dev');
    const enableMetrics = this.config.get<string>('CLOUDWATCH_METRICS_ENABLED', '');

    if (enableMetrics) {
      this.cwClient = new CloudWatchClient({
        region: this.config.get<string>('AWS_REGION', 'us-east-1'),
      });
      this.logger.log('CloudWatch metrics enabled for reconciliation');
    } else {
      this.cwClient = null;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'daily-reconciliation' })
  async reconcile(
    hoursBack = 24,
  ): Promise<ReconciliationResult> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    this.logger.log(`Reconciliation started: ${cutoff.toISOString()} → ${now.toISOString()}`);

    // 1. Fetch all confirmed Koya payouts in the time window
    const koyaPayouts = await this.prisma.payoutInstruction.findMany({
      where: {
        status: 'CONFIRMED',
        updatedAt: { gte: cutoff, lte: now },
        externalId: { not: null },
      },
      select: {
        id: true,
        externalId: true,
        amountMinor: true,
        txHash: true,
      },
    });

    if (koyaPayouts.length === 0) {
      this.logger.log('No confirmed payouts in reconciliation window');
      return {
        date: now.toISOString(),
        totalPayouts: 0,
        matched: 0,
        mismatches: [],
        absDeltaSats: 0,
      };
    }

    // 2. For each, fetch the Bria payout and compare
    const mismatches: ReconciliationMismatch[] = [];
    let matched = 0;

    for (const kp of koyaPayouts) {
      if (!kp.externalId) continue;

      try {
        const briaPayout = await this.briaClient.getPayout({
          externalId: kp.externalId,
        });

        const koyaSats = kp.amountMinor ?? BigInt(0);
        const briaSats = briaPayout.satoshis;
        const delta = briaSats - Number(koyaSats);

        if (delta !== 0) {
          mismatches.push({
            externalId: kp.externalId,
            koyaSats,
            briaSats,
            deltaSats: delta,
            reason: 'amount_mismatch',
          });
        } else {
          matched++;
        }
      } catch (err) {
        mismatches.push({
          externalId: kp.externalId,
          koyaSats: kp.amountMinor ?? BigInt(0),
          briaSats: 0,
          deltaSats: Number(kp.amountMinor ?? 0),
          reason: `bria_lookup_failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    const absDeltaSats = mismatches.reduce(
      (sum, m) => sum + Math.abs(m.deltaSats),
      0,
    );

    const result: ReconciliationResult = {
      date: now.toISOString(),
      totalPayouts: koyaPayouts.length,
      matched,
      mismatches,
      absDeltaSats,
    };

    // 3. Log + alert
    if (absDeltaSats > 1000) {
      this.logger.error(
        `CRITICAL: Reconciliation mismatch — absDelta=${absDeltaSats} sats across ${mismatches.length} payouts`,
      );
    } else if (absDeltaSats > 0) {
      this.logger.warn(
        `WARNING: Reconciliation mismatch — absDelta=${absDeltaSats} sats across ${mismatches.length} payouts`,
      );
    } else {
      this.logger.log(
        `Reconciliation OK: ${matched}/${koyaPayouts.length} payouts matched, 0 sats delta`,
      );
    }

    // 4. Publish CloudWatch metric
    await this.publishMetric('AbsDelta', absDeltaSats);
    await this.publishMetric('MismatchCount', mismatches.length);

    return result;
  }

  private async publishMetric(metricName: string, value: number): Promise<void> {
    if (!this.cwClient) return;

    try {
      await this.cwClient.send(
        new PutMetricDataCommand({
          Namespace: 'Koya/Reconciliation',
          MetricData: [
            {
              MetricName: metricName,
              Value: value,
              Unit: 'Count',
              Timestamp: new Date(),
              Dimensions: [
                { Name: 'Environment', Value: this.environment },
              ],
            },
          ],
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to publish CloudWatch metric ${metricName}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
