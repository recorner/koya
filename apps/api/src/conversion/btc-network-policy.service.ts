import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeBtcNetwork } from '../common/btc-address.utils';

function normalizeBriaRuntimeNetwork(raw: string | undefined): 'bitcoin' | 'testnet' | 'signet' | 'regtest' {
  const normalized = (raw ?? '').toLowerCase().trim();
  if (normalized === 'mainnet' || normalized === 'bitcoin') return 'bitcoin';
  if (normalized === 'testnet' || normalized === 'testnet4') return 'testnet';
  if (normalized === 'signet') return 'signet';
  return 'regtest';
}

function expectedBriaRuntimeFromPolicy(policyNetwork: string): 'bitcoin' | 'testnet' | 'signet' | 'regtest' {
  const normalized = normalizeBtcNetwork(policyNetwork);
  if (normalized === 'bitcoin') return 'bitcoin';
  if (normalized === 'testnet' || normalized === 'testnet4') return 'testnet';
  if (normalized === 'signet') return 'signet';
  return 'regtest';
}

@Injectable()
export class BtcNetworkPolicyService implements OnModuleInit {
  private readonly logger = new Logger(BtcNetworkPolicyService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const environment = (this.config.get<string>('ENVIRONMENT') ?? '').toLowerCase();
    const policyNetwork = normalizeBtcNetwork(this.config.get<string>('BTC_NETWORK', 'bitcoin'));
    const briaRaw = this.config.get<string>('BRIA_NETWORK', 'bitcoin');
    const briaRuntime = normalizeBriaRuntimeNetwork(briaRaw);
    const expectedBriaRuntime = expectedBriaRuntimeFromPolicy(policyNetwork);
    const walletName = this.config.get<string>('BRIA_WALLET_NAME', 'koya-wallet');

    if ((environment === 'production' || environment === 'staging')
      && (policyNetwork === 'regtest' || briaRuntime === 'regtest')) {
      throw new Error(
        `Invalid BTC/Bria network posture for ${environment}: regtest is forbidden (BTC_NETWORK=${policyNetwork}, BRIA_NETWORK=${briaRaw})`,
      );
    }

    if (briaRuntime !== expectedBriaRuntime) {
      throw new Error(
        `Invalid BTC/Bria network pair: BTC_NETWORK=${policyNetwork} expects BRIA runtime network=${expectedBriaRuntime}, got BRIA_NETWORK=${briaRaw}`,
      );
    }

    const productionMode = (this.config.get<string>('BTC_PRODUCTION_NETWORK_MODE') ?? '').toLowerCase();
    if (environment === 'production' && productionMode) {
      if (productionMode === 'testnet4' && policyNetwork !== 'testnet4') {
        throw new Error(
          `Invalid production network mode: BTC_PRODUCTION_NETWORK_MODE=testnet4 requires BTC_NETWORK=testnet4, got ${policyNetwork}`,
        );
      }

      if (productionMode === 'mainnet' && policyNetwork !== 'bitcoin') {
        throw new Error(
          `Invalid production network mode: BTC_PRODUCTION_NETWORK_MODE=mainnet requires BTC_NETWORK=bitcoin, got ${policyNetwork}`,
        );
      }
    }

    this.logger.log(
      `BTC network policy validated (env=${environment || 'unknown'}, BTC_NETWORK=${policyNetwork}, BRIA_RUNTIME_NETWORK=${briaRuntime}, wallet=${walletName}, policy_mode=${productionMode || policyNetwork})`,
    );
  }
}

export {
  normalizeBriaRuntimeNetwork,
  expectedBriaRuntimeFromPolicy,
};
