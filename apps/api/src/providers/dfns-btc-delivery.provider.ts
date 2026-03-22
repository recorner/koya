import { Injectable, Logger } from '@nestjs/common';
import { DfnsService } from '../dfns/dfns.service';
import {
  BtcDeliveryProvider,
  BtcSendInput,
  BtcSendResult,
} from './btc-delivery.interface';

@Injectable()
export class DfnsBtcDeliveryProvider implements BtcDeliveryProvider {
  private readonly logger = new Logger(DfnsBtcDeliveryProvider.name);

  constructor(private readonly dfnsService: DfnsService) {}

  async send(input: BtcSendInput): Promise<BtcSendResult> {
    const externalId = `koya:conversion:${input.referenceCode}`;

    try {
      const result = await this.dfnsService.requestCustodyMove({
        externalId,
        destination: input.address,
        satoshis: Number(input.amountSatoshis),
      });

      this.logger.log(
        `DFNS custody move requested: dfnsRequestId=${result.dfnsRequestId} externalId=${externalId}`,
      );

      // Return DFNS request ID as txHash for tracking.
      // Real on-chain txId arrives via DFNS webhook → DfnsController.
      return {
        success: true,
        txHash: result.dfnsRequestId,
        confirmations: 0,
      };
    } catch (err) {
      this.logger.error(
        `DFNS custody move failed for ${externalId}`,
        err instanceof Error ? err.message : err,
      );
      return { success: false, txHash: '', confirmations: 0 };
    }
  }
}
