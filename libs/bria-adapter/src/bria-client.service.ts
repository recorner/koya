import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Observable } from 'rxjs';
import * as path from 'path';

import { BRIA_API_KEY_HEADER, BRIA_DEFAULTS, BRIA_ENV, GRPC_PACKAGES, PROTO_PATHS } from './bria.constants';
import { BriaClientError } from './bria.errors';
import type {
  BriaEvent,
  BriaEventPayload,
  CreateProfileInput,
  CreateProfileResult,
  CreateProfileApiKeyResult,
  CreateWalletInput,
  CreateWalletResult,
  EstimatePayoutFeeInput,
  EstimatePayoutFeeResult,
  GetPayoutInput,
  GrpcClient,
  ImportXpubInput,
  ImportXpubResult,
  KeychainConfig,
  NewAddressInput,
  NewAddressResult,
  PayoutInfo,
  SubmitPayoutInput,
  SubmitPayoutResult,
  SubmitSignedPsbtInput,
  SubscribeAllInput,
  WalletBalanceSummary,
} from './bria.types';

@Injectable()
export class BriaClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BriaClientService.name);
  private client!: GrpcClient;
  private readonly apiKey: string;
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor(private readonly config: ConfigService) {
    this.host = this.config.get<string>(BRIA_ENV.API_HOST) ?? BRIA_DEFAULTS.API_HOST;
    this.port = this.config.get<number>(BRIA_ENV.API_PORT) ?? BRIA_DEFAULTS.API_PORT;
    this.apiKey = this.config.get<string>(BRIA_ENV.API_KEY) ?? '';
    this.timeoutMs = BRIA_DEFAULTS.TIMEOUT_MS;
    this.maxRetries = BRIA_DEFAULTS.RETRY_MAX_ATTEMPTS;
    this.retryBaseDelayMs = BRIA_DEFAULTS.RETRY_BASE_DELAY_MS;
  }

  async onModuleInit(): Promise<void> {
    const protoPath = path.join(__dirname, '..', 'proto', PROTO_PATHS.API);
    const packageDefinition = await protoLoader.load(protoPath, {
      keepCase: false,
      longs: Number,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [path.join(__dirname, '..', 'proto')],
    });

    const grpcObject = grpc.loadPackageDefinition(packageDefinition);
    const pkg = this.resolvePackage(grpcObject, GRPC_PACKAGES.API);
    const ServiceConstructor = pkg['BriaService'] as unknown as new (
      addr: string,
      creds: grpc.ChannelCredentials,
    ) => GrpcClient;

    this.client = new ServiceConstructor(
      `${this.host}:${this.port}`,
      grpc.credentials.createInsecure(),
    );

    this.logger.log(`Connected to Bria gRPC API at ${this.host}:${this.port}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.client?.close();
  }

  // ─── Profile ─────────────────────────────────────────────

  async createProfile(input: CreateProfileInput): Promise<CreateProfileResult> {
    const req: Record<string, unknown> = { name: input.name };
    if (input.spendingPolicy) {
      req['spendingPolicy'] = {
        allowedPayoutAddresses: input.spendingPolicy.allowedPayoutAddresses ?? [],
        maxPayoutSats: input.spendingPolicy.maxPayoutSats,
      };
    }
    const res = await this.callWithRetry<{ id: string }>('createProfile', req);
    return { id: res.id };
  }

  async createProfileApiKey(profileName: string): Promise<CreateProfileApiKeyResult> {
    const res = await this.callWithRetry<{ id: string; key: string }>(
      'createProfileApiKey',
      { profileName },
    );
    return { id: res.id, key: res.key };
  }

  // ─── Xpub ───────────────────────────────────────────────

  async importXpub(input: ImportXpubInput): Promise<ImportXpubResult> {
    const res = await this.callWithRetry<{ id: string }>('importXpub', {
      name: input.name,
      xpub: input.xpub,
      derivation: input.derivation,
    });
    return { id: res.id };
  }

  // ─── Wallet ──────────────────────────────────────────────

  async createWallet(input: CreateWalletInput): Promise<CreateWalletResult> {
    const res = await this.callWithRetry<{ id: string; xpubIds: string[] }>(
      'createWallet',
      {
        name: input.name,
        keychainConfig: this.buildKeychainConfig(input.keychainConfig),
      },
    );
    return { id: res.id, xpubIds: res.xpubIds ?? [] };
  }

  async getWalletBalance(walletName: string): Promise<WalletBalanceSummary> {
    return this.callWithRetry<WalletBalanceSummary>('getWalletBalanceSummary', {
      walletName,
    });
  }

  // ─── Address ─────────────────────────────────────────────

  async newAddress(input: NewAddressInput): Promise<NewAddressResult> {
    const req: Record<string, unknown> = { walletName: input.walletName };
    if (input.externalId) req['externalId'] = input.externalId;
    if (input.metadata) req['metadata'] = this.toStruct(input.metadata);
    const res = await this.callWithRetry<{ address: string }>('newAddress', req);
    return { address: res.address };
  }

  // ─── Payout ──────────────────────────────────────────────

  async submitPayout(input: SubmitPayoutInput): Promise<SubmitPayoutResult> {
    const req: Record<string, unknown> = {
      walletName: input.walletName,
      payoutQueueName: input.payoutQueueName,
      satoshis: input.satoshis,
    };

    if ('onchainAddress' in input.destination) {
      req['onchainAddress'] = input.destination.onchainAddress;
    } else {
      req['destinationWalletName'] = input.destination.destinationWalletName;
    }

    if (input.externalId) req['externalId'] = input.externalId;
    if (input.metadata) req['metadata'] = this.toStruct(input.metadata);

    const res = await this.callWithRetry<{
      id: string;
      batchInclusionEstimatedAt?: number;
    }>('submitPayout', req);

    return {
      id: res.id,
      batchInclusionEstimatedAt: res.batchInclusionEstimatedAt,
    };
  }

  async estimatePayoutFee(input: EstimatePayoutFeeInput): Promise<EstimatePayoutFeeResult> {
    const req: Record<string, unknown> = {
      walletName: input.walletName,
      payoutQueueName: input.payoutQueueName,
      satoshis: input.satoshis,
    };

    if ('onchainAddress' in input.destination) {
      req['onchainAddress'] = input.destination.onchainAddress;
    } else {
      req['destinationWalletName'] = input.destination.destinationWalletName;
    }

    const res = await this.callWithRetry<{ satoshis: number }>('estimatePayoutFee', req);
    return { satoshis: res.satoshis };
  }

  async getPayout(input: GetPayoutInput): Promise<PayoutInfo> {
    const req: Record<string, unknown> = {};
    if (input.id) req['id'] = input.id;
    if (input.externalId) req['externalId'] = input.externalId;

    const res = await this.callWithRetry<{ payout: PayoutInfo }>('getPayout', req);
    return res.payout;
  }

  async cancelPayout(id: string): Promise<void> {
    await this.callWithRetry('cancelPayout', { id });
  }

  // ─── Batch / Signing ────────────────────────────────────

  async submitSignedPsbt(input: SubmitSignedPsbtInput): Promise<void> {
    await this.callWithRetry('submitSignedPsbt', {
      batchId: input.batchId,
      xpubRef: input.xpubRef,
      signedPsbt: input.signedPsbt,
    });
  }

  // ─── Event Stream ────────────────────────────────────────

  subscribeAll(input: SubscribeAllInput = {}): Observable<BriaEvent> {
    return new Observable<BriaEvent>((subscriber) => {
      const metadata = this.buildMetadata();
      const req: Record<string, unknown> = {};
      if (input.afterSequence !== undefined) req['afterSequence'] = input.afterSequence;
      if (input.augment !== undefined) req['augment'] = input.augment;

      const clientRecord = this.client as unknown as Record<string, (...args: unknown[]) => grpc.ClientReadableStream<unknown>>;
      const streamFn = clientRecord['subscribeAll'];
      if (!streamFn) {
        throw new Error('subscribeAll method not found on gRPC client');
      }
      const call = streamFn(req, metadata) as grpc.ClientReadableStream<Record<string, unknown>>;

      call.on('data', (raw: Record<string, unknown>) => {
        if (subscriber.closed) return;
        try {
          const event = this.parseEvent(raw);
          subscriber.next(event);
        } catch (err) {
          this.logger.error('Failed to parse Bria event', err);
        }
      });

      call.on('error', (err: { code?: number; message?: string; details?: string }) => {
        if (subscriber.closed) return;
        subscriber.error(BriaClientError.fromGrpcError(err));
      });

      call.on('end', () => {
        if (subscriber.closed) return;
        subscriber.complete();
      });

      return () => {
        call.cancel();
      };
    });
  }

  // ─── Internals ──────────────────────────────────────────

  private buildMetadata(overrideApiKey?: string): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.add(BRIA_API_KEY_HEADER, overrideApiKey ?? this.apiKey);
    return metadata;
  }

  private async callWithRetry<T>(method: string, request: unknown, attempt = 0): Promise<T> {
    try {
      return await this.callUnary<T>(method, request);
    } catch (err) {
      if (err instanceof BriaClientError && err.isTransient && attempt < this.maxRetries) {
        const delay = this.retryBaseDelayMs * Math.pow(2, attempt);
        this.logger.warn(
          `Transient error on ${method} (attempt ${attempt + 1}/${this.maxRetries}): ${err.message}. Retrying in ${delay}ms`,
        );
        await this.sleep(delay);
        return this.callWithRetry<T>(method, request, attempt + 1);
      }
      throw err;
    }
  }

  private callUnary<T>(method: string, request: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const metadata = this.buildMetadata();
      const deadline = new Date(Date.now() + this.timeoutMs);

      const fn = (this.client as unknown as Record<string, (...args: unknown[]) => unknown>)[method];
      if (typeof fn !== 'function') {
        reject(new Error(`Unknown gRPC method: ${method}`));
        return;
      }

      fn.call(
        this.client,
        request,
        metadata,
        { deadline },
        (err: { code?: number; message?: string; details?: string } | null, response: T) => {
          if (err) {
            reject(BriaClientError.fromGrpcError(err));
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  private buildKeychainConfig(config: KeychainConfig): Record<string, unknown> {
    if (config.wpkh) {
      return { wpkh: { xpub: config.wpkh.xpub, derivationPath: config.wpkh.derivationPath } };
    }
    if (config.descriptors) {
      return { descriptors: { external: config.descriptors.external, internal: config.descriptors.internal } };
    }
    if (config.sortedMultisig) {
      return { sortedMultisig: { xpubs: config.sortedMultisig.xpubs, threshold: config.sortedMultisig.threshold } };
    }
    throw new Error('Invalid keychain config: one of wpkh, descriptors, or sortedMultisig is required');
  }

  /** Convert JS object to google.protobuf.Struct shape */
  private toStruct(obj: Record<string, unknown>): { fields: Record<string, unknown> } {
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      fields[key] = this.toValue(value);
    }
    return { fields };
  }

  private toValue(value: unknown): Record<string, unknown> {
    if (value === null || value === undefined) return { nullValue: 0 };
    if (typeof value === 'number') return { numberValue: value };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'boolean') return { boolValue: value };
    if (Array.isArray(value)) return { listValue: { values: value.map((v) => this.toValue(v)) } };
    if (typeof value === 'object') return { structValue: this.toStruct(value as Record<string, unknown>) };
    return { stringValue: String(value) };
  }

  private parseEvent(raw: Record<string, unknown>): BriaEvent {
    const sequence = raw['sequence'] as number;
    const recordedAt = raw['recordedAt'] as number;
    const payload = this.parsePayload(raw);
    return { sequence, recordedAt, payload };
  }

  private parsePayload(raw: Record<string, unknown>): BriaEventPayload {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    if (raw['utxoDetected']) return { type: 'utxo_detected', data: raw['utxoDetected'] } as any;
    if (raw['utxoSettled']) return { type: 'utxo_settled', data: raw['utxoSettled'] } as any;
    if (raw['utxoDropped']) return { type: 'utxo_dropped', data: raw['utxoDropped'] } as any;
    if (raw['payoutSubmitted']) return { type: 'payout_submitted', data: raw['payoutSubmitted'] } as any;
    if (raw['payoutCancelled']) return { type: 'payout_cancelled', data: raw['payoutCancelled'] } as any;
    if (raw['payoutCommitted']) return { type: 'payout_committed', data: raw['payoutCommitted'] } as any;
    if (raw['payoutBroadcast']) return { type: 'payout_broadcast', data: raw['payoutBroadcast'] } as any;
    if (raw['payoutSettled']) return { type: 'payout_settled', data: raw['payoutSettled'] } as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    throw new Error(`Unknown Bria event payload: ${JSON.stringify(raw)}`);
  }

  private resolvePackage(obj: grpc.GrpcObject, pkg: string): grpc.GrpcObject {
    const parts = pkg.split('.');
    let current: grpc.GrpcObject = obj;
    for (const part of parts) {
      current = current[part] as grpc.GrpcObject;
      if (!current) throw new Error(`Could not resolve gRPC package: ${pkg}`);
    }
    return current;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
