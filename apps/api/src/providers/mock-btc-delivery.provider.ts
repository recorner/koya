import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
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
export class MockBtcDeliveryProvider implements BtcBackendProvider {
  readonly backend = 'mock';

  async generateDepositAddress(
    input: BtcGenerateDepositAddressInput,
  ): Promise<BtcGenerateDepositAddressResult> {
    const external = input.externalId ?? `koya:deposit:mock:${uuidv4()}`;
    return {
      address: 'tb1q8f4kv4x8fjw4zylxj2q7pwqw7ylhdu4f8q8h5f',
      externalId: external,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async submitPayout(input: BtcSubmitPayoutInput): Promise<BtcSubmitPayoutResult> {
    return {
      providerPayoutId: `mock_payout_${uuidv4().replace(/-/g, '')}`,
      txId: `mock_tx_${uuidv4().replace(/-/g, '')}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPayout(_input: BtcGetPayoutInput): Promise<BtcGetPayoutResult | null> {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  classifyError(_error: unknown): BtcBackendErrorClassification {
    return {
      retryable: false,
      reason: 'mock_backend_no_error',
    };
  }

  capabilities(): BtcBackendCapability[] {
    return [
      'deposit_address_generation',
      'payout_submission',
      'payout_lookup',
    ];
  }

  healthMetadata(): BtcBackendHealthMetadata {
    return {
      backend: this.backend,
      healthy: true,
      capabilities: this.capabilities(),
      network: 'testnet4',
    };
  }
}
