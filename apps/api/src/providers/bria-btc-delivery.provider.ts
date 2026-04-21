import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BriaClientService, BriaClientError, BriaErrorCode } from '@koya/bria-adapter';
import { validateBtcAddressForNetwork } from '../common/btc-address.utils';
import {
  BtcBackendCapability,
  BtcBackendErrorClassification,
  BtcBackendHealthMetadata,
  BtcBackendProvider,
  BtcGenerateDepositAddressInput,
  BtcGenerateDepositAddressResult,
  BtcGetPayoutInput,
  BtcGetPayoutResult,
  BtcSubmitPayoutInput,
  BtcSubmitPayoutResult,
} from './btc-backend.interface';

@Injectable()
export class BriaBtcDeliveryProvider implements BtcBackendProvider {
  readonly backend = 'bria';
  private readonly logger = new Logger(BriaBtcDeliveryProvider.name);
  private readonly walletName: string;
  private readonly payoutQueueName: string;
  private readonly btcNetwork: string;

  constructor(
    private readonly briaClient: BriaClientService,
    private readonly config: ConfigService,
  ) {
    this.walletName = this.config.get<string>('BRIA_WALLET_NAME', 'koya-wallet');
    this.payoutQueueName = this.config.get<string>('BRIA_PAYOUT_QUEUE_NAME')
      ?? this.config.get<string>('BRIA_PAYOUT_QUEUE', 'default');
    this.btcNetwork = this.config.get<string>('BTC_NETWORK', 'bitcoin');
  }

  async generateDepositAddress(
    input: BtcGenerateDepositAddressInput,
  ): Promise<BtcGenerateDepositAddressResult> {
    const walletName = input.walletName ?? this.walletName;
    const res = await this.briaClient.newAddress({
      walletName,
      externalId: input.externalId,
      metadata: input.metadata,
    });

    const validation = validateBtcAddressForNetwork(res.address, this.btcNetwork);
    if (!validation.valid) {
      throw new Error(
        `Bria emitted address not valid for configured BTC network (configured=${this.btcNetwork}, detected=${validation.detectedNetwork ?? 'unknown'})`,
      );
    }

    return {
      address: res.address,
      externalId: input.externalId,
    };
  }

  async submitPayout(input: BtcSubmitPayoutInput): Promise<BtcSubmitPayoutResult> {
    const externalId = `koya:conversion:${input.referenceCode}`;
    const validation = validateBtcAddressForNetwork(input.address, this.btcNetwork);
    if (!validation.valid) {
      throw new Error(
        `Invalid BTC address for configured network (${this.btcNetwork}); detected=${validation.detectedNetwork ?? 'unknown'}`,
      );
    }

    try {
      const result = await this.briaClient.submitPayout({
        walletName: this.walletName,
        payoutQueueName: this.payoutQueueName,
        destination: { onchainAddress: input.address },
        satoshis: Number(input.amountSatoshis),
        externalId,
        metadata: input.metadata,
      });

      this.logger.log(
        `Payout submitted: payoutId=${result.id} externalId=${externalId} address=${input.address}`,
      );

      return {
        providerPayoutId: result.id,
      };
    } catch (err) {
      if (err instanceof BriaClientError && err.code === BriaErrorCode.ALREADY_EXISTS) {
        this.logger.warn(`Idempotent payout: ${externalId} already exists, looking up`);
        const existing = await this.briaClient.getPayout({ externalId });
        return {
          providerPayoutId: existing.id,
          txId: existing.txId,
        };
      }

      throw err;
    }
  }

  async getPayout(input: BtcGetPayoutInput): Promise<BtcGetPayoutResult | null> {
    try {
      const payout = await this.briaClient.getPayout(input);
      return {
        id: payout.id,
        externalId: payout.externalId,
        txId: payout.txId,
        cancelled: payout.cancelled,
      };
    } catch (error) {
      if (error instanceof BriaClientError && error.code === BriaErrorCode.NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  classifyError(error: unknown): BtcBackendErrorClassification {
    if (error instanceof BriaClientError) {
      if (error.isTransient) {
        return {
          retryable: true,
          reason: error.code,
          suggestedDelayMs: 2000,
        };
      }

      return {
        retryable: false,
        reason: error.code,
      };
    }

    return {
      retryable: false,
      reason: error instanceof Error ? error.message : 'unknown_error',
    };
  }

  capabilities(): BtcBackendCapability[] {
    return [
      'deposit_address_generation',
      'payout_submission',
      'payout_lookup',
      'event_stream',
    ];
  }

  healthMetadata(): BtcBackendHealthMetadata {
    return {
      backend: this.backend,
      healthy: Boolean(this.walletName && this.payoutQueueName),
      capabilities: this.capabilities(),
      network: this.btcNetwork,
      walletName: this.walletName,
      payoutQueueName: this.payoutQueueName,
    };
  }
}
