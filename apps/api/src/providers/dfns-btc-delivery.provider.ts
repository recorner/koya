import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BriaClientService } from '@koya/bria-adapter';
import {
  BtcDeliveryProvider,
  BtcSendInput,
  BtcSendResult,
} from './btc-delivery.interface';

/**
 * DfnsBtcDeliveryProvider — uses Bria for payout submission and UTXO management,
 * with DFNS as the external signer. The flow:
 *
 * 1. Submit payout to Bria (Bria manages UTXOs, builds PSBT in batch)
 * 2. BriaEventConsumer catches payout_committed, retrieves unsigned PSBT
 * 3. PsbtSigningService sends PSBT to DFNS for signing
 * 4. Signed PSBT returned to Bria for broadcast
 *
 * This provider only handles step 1 — submitting the payout.
 * Steps 2-4 are handled asynchronously by BriaEventConsumer + PsbtSigningService.
 */
@Injectable()
export class DfnsBtcDeliveryProvider implements BtcDeliveryProvider {
  private readonly logger = new Logger(DfnsBtcDeliveryProvider.name);
  private readonly walletName: string;
  private readonly queueName: string;

  constructor(
    private readonly briaClient: BriaClientService,
    private readonly config: ConfigService,
  ) {
    this.walletName = this.config.get<string>('BRIA_WALLET_NAME', 'default');
    this.queueName = this.config.get<string>('BRIA_PAYOUT_QUEUE_NAME', 'default');
  }

  async send(input: BtcSendInput): Promise<BtcSendResult> {
    const externalId = `koya:conversion:${input.referenceCode}`;

    try {
      // Submit payout to Bria — Bria will batch it and create an unsigned PSBT.
      // The BriaEventConsumer will pick up the payout_committed event and
      // orchestrate DFNS signing via PsbtSigningService.
      const result = await this.briaClient.submitPayout({
        walletName: this.walletName,
        payoutQueueName: this.queueName,
        destination: { onchainAddress: input.address },
        satoshis: Number(input.amountSatoshis),
        externalId,
        metadata: { referenceCode: input.referenceCode, driver: 'dfns' },
      });

      this.logger.log(
        `Payout submitted to Bria for DFNS signing: payoutId=${result.id} externalId=${externalId}`,
      );

      // Return Bria payout ID for tracking.
      // On-chain txId arrives later via BriaEventConsumer (payout_broadcast/settled).
      return {
        success: true,
        txHash: result.id,
        confirmations: 0,
      };
    } catch (err) {
      this.logger.error(
        `Bria payout submission failed for ${externalId}`,
        err instanceof Error ? err.message : err,
      );
      return { success: false, txHash: '', confirmations: 0 };
    }
  }
}
