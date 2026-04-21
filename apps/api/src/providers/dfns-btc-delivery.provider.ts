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

/**
 * DfnsBtcDeliveryProvider — uses Bria for payout submission and UTXO management,
 * with DFNS as the external signer. The flow:
 *
 * 1. Submit payout to Bria (Bria manages UTXOs, builds PSBT in batch)
 * 2. BriaEventConsumer catches payout_committed, retrieves unsigned PSBT
 * 3. PsbtSigningService sends PSBT to DFNS for signing
 * 4. Signed PSBT returned to Bria for broadcast
 */
@Injectable()
export class DfnsBtcDeliveryProvider implements BtcBackendProvider {
  readonly backend = 'dfns';
  private readonly logger = new Logger(DfnsBtcDeliveryProvider.name);
  private readonly walletName: string;
  private readonly queueName: string;
  private readonly btcNetwork: string;

  constructor(
    private readonly briaClient: BriaClientService,
    private readonly config: ConfigService,
  ) {
    this.walletName = this.config.get<string>('BRIA_WALLET_NAME', 'default');
    this.queueName = this.config.get<string>('BRIA_PAYOUT_QUEUE_NAME', 'default');
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
        payoutQueueName: this.queueName,
        destination: { onchainAddress: input.address },
        satoshis: Number(input.amountSatoshis),
        externalId,
        metadata: { referenceCode: input.referenceCode, driver: this.backend, ...input.metadata },
      });

      this.logger.log(
        `Payout submitted to Bria for DFNS signing: payoutId=${result.id} externalId=${externalId}`,
      );

      return {
        providerPayoutId: result.id,
      };
    } catch (error) {
      if (error instanceof BriaClientError && error.code === BriaErrorCode.ALREADY_EXISTS) {
        const existing = await this.briaClient.getPayout({ externalId });
        return {
          providerPayoutId: existing.id,
          txId: existing.txId,
        };
      }
      throw error;
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
      if (error.isTransient || error.code === BriaErrorCode.INTERNAL) {
        return {
          retryable: true,
          reason: error.code,
          suggestedDelayMs: 2500,
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
      healthy: Boolean(this.walletName && this.queueName),
      capabilities: this.capabilities(),
      network: this.btcNetwork,
      walletName: this.walletName,
      payoutQueueName: this.queueName,
    };
  }
}
