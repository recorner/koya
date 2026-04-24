import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BriaAdminService,
  BriaClientService,
  BriaClientError,
  BriaErrorCode,
} from '@koya/bria-adapter';

@Injectable()
export class BriaSetupService {
  private readonly logger = new Logger(BriaSetupService.name);
  private readonly walletName: string;
  private readonly accountName: string;
  private readonly serviceProfileName: string;

  constructor(
    private readonly briaAdmin: BriaAdminService,
    private readonly briaClient: BriaClientService,
    private readonly config: ConfigService,
  ) {
    this.walletName = this.config.get<string>('BRIA_WALLET_NAME', 'koya-wallet');
    this.accountName = this.config.get<string>('BRIA_ACCOUNT_NAME', `${this.walletName}-account`);
    this.serviceProfileName = this.config.get<string>('BRIA_SERVICE_PROFILE', `${this.walletName}-service`);
  }

  async bootstrapAdmin(): Promise<{ key: string }> {
    this.logger.log('Bootstrapping Bria admin...');
    try {
      const result = await this.briaAdmin.bootstrap();
      this.logger.log(`Admin bootstrapped: id=${result.id} name=${result.name}`);
      return { key: result.key };
    } catch (err) {
      if (err instanceof BriaClientError && err.code === BriaErrorCode.ALREADY_EXISTS) {
        this.logger.warn('Bria admin already bootstrapped');
        return { key: '(already bootstrapped — use existing key)' };
      }
      throw err;
    }
  }

  async createKoyaAccount(): Promise<{ accountId: string; key: string }> {
    this.logger.log(`Creating Bria account '${this.accountName}'...`);
    try {
      const accounts = await this.briaAdmin.listAccounts();
      const existing = accounts.find((a) => a.name === this.accountName);
      if (existing) {
        this.logger.warn(`Account '${this.accountName}' already exists: id=${existing.id}`);
        return { accountId: existing.id, key: '(use existing account key)' };
      }
    } catch {
      // listAccounts may fail if admin key not configured — proceed to create
    }

    const result = await this.briaAdmin.createAccount(this.accountName);
    this.logger.log(`Account created: accountId=${result.accountId}`);
    return { accountId: result.accountId, key: result.key };
  }

  async createServiceProfile(): Promise<{ profileId: string; apiKey: string }> {
    this.logger.log(`Creating service profile '${this.serviceProfileName}'...`);
    try {
      const profile = await this.briaClient.createProfile({ name: this.serviceProfileName });
      const apiKey = await this.briaClient.createProfileApiKey(this.serviceProfileName);
      this.logger.log(`Profile created: id=${profile.id} apiKeyId=${apiKey.id}`);
      return { profileId: profile.id, apiKey: apiKey.key };
    } catch (err) {
      if (err instanceof BriaClientError && err.code === BriaErrorCode.ALREADY_EXISTS) {
        this.logger.warn(`Profile '${this.serviceProfileName}' already exists, creating new API key`);
        const apiKey = await this.briaClient.createProfileApiKey(this.serviceProfileName);
        return { profileId: '(existing)', apiKey: apiKey.key };
      }
      throw err;
    }
  }

  async importXpubAndCreateWallet(
    xpub: string,
    derivation = "m/84'/1'/0'",
  ): Promise<{ walletId: string; xpubId: string }> {
    this.logger.log(`Importing xpub and creating wallet '${this.walletName}'...`);

    let xpubId: string;
    try {
      const xpubResult = await this.briaClient.importXpub({
        name: `${this.walletName}-xpub`,
        xpub,
        derivation,
      });
      xpubId = xpubResult.id;
    } catch (err) {
      if (err instanceof BriaClientError && err.code === BriaErrorCode.ALREADY_EXISTS) {
        this.logger.warn('Xpub already imported');
        xpubId = '(existing)';
      } else {
        throw err;
      }
    }

    try {
      const wallet = await this.briaClient.createWallet({
        name: this.walletName,
        keychainConfig: { wpkh: { xpub } },
      });
      this.logger.log(`Wallet created: id=${wallet.id}`);
      return { walletId: wallet.id, xpubId };
    } catch (err) {
      if (err instanceof BriaClientError && err.code === BriaErrorCode.ALREADY_EXISTS) {
        this.logger.warn(`Wallet '${this.walletName}' already exists`);
        return { walletId: '(existing)', xpubId };
      }
      throw err;
    }
  }

  async verifySetup(): Promise<{ address: string }> {
    this.logger.log(`Verifying setup — generating address from '${this.walletName}'...`);
    const result = await this.briaClient.newAddress({ walletName: this.walletName });
    this.logger.log(`Verification address: ${result.address}`);
    return { address: result.address };
  }

  async runFullSetup(xpub?: string): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    results['bootstrap'] = await this.bootstrapAdmin();
    results['account'] = await this.createKoyaAccount();
    results['profile'] = await this.createServiceProfile();
    if (xpub) {
      results['wallet'] = await this.importXpubAndCreateWallet(xpub);
      results['verify'] = await this.verifySetup();
    }
    return results;
  }
}
