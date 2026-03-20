import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BriaClientService, BriaClientError, BriaErrorCode } from '@koya/bria-adapter';
import {
  BtcDeliveryProvider,
  BtcSendInput,
  BtcSendResult,
} from './btc-delivery.interface';

@Injectable()
export class BriaBtcDeliveryProvider implements BtcDeliveryProvider {
  private readonly logger = new Logger(BriaBtcDeliveryProvider.name);
  private readonly walletName: string;
  private readonly payoutQueueName: string;

  constructor(
    private readonly briaClient: BriaClientService,
    private readonly config: ConfigService,
  ) {
    this.walletName = this.config.get<string>('BRIA_WALLET_NAME', 'koya-wallet');
    this.payoutQueueName = this.config.get<string>('BRIA_PAYOUT_QUEUE', 'default');
  }

  async send(input: BtcSendInput): Promise<BtcSendResult> {
    const externalId = `koya:conversion:${input.referenceCode}`;

    try {
      const result = await this.briaClient.submitPayout({
        walletName: this.walletName,
        payoutQueueName: this.payoutQueueName,
        destination: { onchainAddress: input.address },
        satoshis: Number(input.amountSatoshis),
        externalId,
      });

      this.logger.log(
        `Payout submitted: payoutId=${result.id} externalId=${externalId} address=${input.address}`,
      );

      // Return Bria payout ID as txHash for tracking; real on-chain txId arrives via event consumer
      return { success: true, txHash: result.id, confirmations: 0 };
    } catch (err) {
      if (err instanceof BriaClientError && err.code === BriaErrorCode.ALREADY_EXISTS) {
        this.logger.warn(`Idempotent payout: ${externalId} already exists, looking up`);
        try {
          const existing = await this.briaClient.getPayout({ externalId });
          this.logger.log(`Found existing payout: ${existing.id} txId=${existing.txId ?? 'pending'}`);
          return { success: true, txHash: existing.txId ?? '', confirmations: 0 };
        } catch (lookupErr) {
          this.logger.error(`Failed to look up existing payout ${externalId}`, lookupErr);
          return { success: false, txHash: '', confirmations: 0 };
        }
      }

      this.logger.error(`Payout submission failed for ${externalId}`, err);
      return { success: false, txHash: '', confirmations: 0 };
    }
  }
}
