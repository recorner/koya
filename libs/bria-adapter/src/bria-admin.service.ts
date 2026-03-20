import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

import { BRIA_API_KEY_HEADER, BRIA_DEFAULTS, BRIA_ENV, GRPC_PACKAGES, PROTO_PATHS } from './bria.constants';
import { BriaClientError } from './bria.errors';
import type {
  AccountInfo,
  BootstrapResult,
  CreateAccountResult,
  GrpcClient,
} from './bria.types';

@Injectable()
export class BriaAdminService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BriaAdminService.name);
  private client!: GrpcClient;
  private readonly adminApiKey: string;
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.host = this.config.get<string>(BRIA_ENV.ADMIN_HOST) ?? BRIA_DEFAULTS.ADMIN_HOST;
    this.port = this.config.get<number>(BRIA_ENV.ADMIN_PORT) ?? BRIA_DEFAULTS.ADMIN_PORT;
    this.adminApiKey = this.config.get<string>(BRIA_ENV.ADMIN_API_KEY) ?? '';
    this.timeoutMs = BRIA_DEFAULTS.TIMEOUT_MS;
  }

  async onModuleInit(): Promise<void> {
    const protoPath = path.join(__dirname, '..', 'proto', PROTO_PATHS.ADMIN);
    const packageDefinition = await protoLoader.load(protoPath, {
      keepCase: false,
      longs: Number,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [path.join(__dirname, '..', 'proto')],
    });

    const grpcObject = grpc.loadPackageDefinition(packageDefinition);
    const pkg = this.resolvePackage(grpcObject, GRPC_PACKAGES.ADMIN);
    const ServiceConstructor = pkg['AdminService'] as unknown as new (
      addr: string,
      creds: grpc.ChannelCredentials,
    ) => GrpcClient;

    this.client = new ServiceConstructor(
      `${this.host}:${this.port}`,
      grpc.credentials.createInsecure(),
    );

    this.logger.log(`Connected to Bria Admin gRPC at ${this.host}:${this.port}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.client?.close();
  }

  /** Bootstrap Bria — creates the initial admin API key. Call once on first setup. */
  async bootstrap(): Promise<BootstrapResult> {
    const res = await this.callUnary<{ key: { id: string; name: string; key: string } }>(
      'bootstrap',
      {},
    );
    return res.key;
  }

  /** Create a new Bria account. Returns a profile API key for the default profile. */
  async createAccount(name: string): Promise<CreateAccountResult> {
    const metadata = this.buildMetadata();
    const res = await this.callUnaryWithMetadata<{
      key: { profileId: string; name: string; key: string; accountId: string };
    }>('createAccount', { name }, metadata);
    return res.key;
  }

  /** List all accounts. */
  async listAccounts(): Promise<AccountInfo[]> {
    const metadata = this.buildMetadata();
    const res = await this.callUnaryWithMetadata<{ accounts: AccountInfo[] }>(
      'listAccounts',
      {},
      metadata,
    );
    return res.accounts ?? [];
  }

  // ─── Internals ──────────────────────────────────────────

  private buildMetadata(): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.add(BRIA_API_KEY_HEADER, this.adminApiKey);
    return metadata;
  }

  /** Call without metadata (bootstrap — no auth needed) */
  private callUnary<T>(method: string, request: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + this.timeoutMs);

      const fn = (this.client as unknown as Record<string, (...args: unknown[]) => unknown>)[method];
      if (typeof fn !== 'function') {
        reject(new Error(`Unknown admin gRPC method: ${method}`));
        return;
      }

      fn.call(
        this.client,
        request,
        { deadline },
        (err: { code?: number; message?: string; details?: string } | null, response: T) => {
          if (err) reject(BriaClientError.fromGrpcError(err));
          else resolve(response);
        },
      );
    });
  }

  /** Call with metadata (authenticated) */
  private callUnaryWithMetadata<T>(
    method: string,
    request: unknown,
    metadata: grpc.Metadata,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const deadline = new Date(Date.now() + this.timeoutMs);

      const fn = (this.client as unknown as Record<string, (...args: unknown[]) => unknown>)[method];
      if (typeof fn !== 'function') {
        reject(new Error(`Unknown admin gRPC method: ${method}`));
        return;
      }

      fn.call(
        this.client,
        request,
        metadata,
        { deadline },
        (err: { code?: number; message?: string; details?: string } | null, response: T) => {
          if (err) reject(BriaClientError.fromGrpcError(err));
          else resolve(response);
        },
      );
    });
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
}
