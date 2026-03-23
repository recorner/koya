/** DFNSClient — PSBT signing client with mTLS + API-key fallback */

import * as https from 'https';
import { DfnsTransientError, DfnsPermanentError } from './dfns.errors';
import { retryWithBackoff } from './dfns.retry';
import { verifyHmacSignature } from './dfns.signature';
import type {
  DfnsClientOptions,
  DfnsLogger,
  SignPsbtParams,
  SignPsbtResult,
  RequestStatusResult,
  WebhookPayload,
} from './dfns.types';

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_TIMEOUT_MS = 15_000;

interface DfnsApiSignResponse {
  dfnsRequestId: string;
  signedPsbt: string;
  signerMeta: { signerId: string; timestamp: string };
  error?: string;
}

export class DFNSClient {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly walletId: string;
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly logger: DfnsLogger;
  private readonly httpsAgent: https.Agent | undefined;

  constructor(opts: DfnsClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.appId = opts.appId;
    this.walletId = opts.walletId;
    this.apiKey = opts.apiKey ?? '';
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const noop = () => {};
    this.logger = opts.logger ?? { log: noop, warn: noop, error: noop };

    // mTLS agent
    if (opts.mTlsOptions) {
      this.httpsAgent = new https.Agent({
        cert: opts.mTlsOptions.cert,
        key: opts.mTlsOptions.key,
        ca: opts.mTlsOptions.ca,
        rejectUnauthorized: true,
      });
    }
  }

  /**
   * Request DFNS to sign a PSBT.
   * Includes the externalId as Idempotency-Key header.
   * If DFNS returns 409 (ALREADY_EXISTS), treats it as success and returns existing payload.
   */
  async requestSignPsbt(params: SignPsbtParams): Promise<SignPsbtResult> {
    const walletId = params.walletId ?? this.walletId;
    const url = `${this.baseUrl}/wallets/${walletId}/sign-psbt`;

    const body = {
      externalId: params.externalId,
      psbt: params.psbtBase64,
      psbtId: params.psbtId,
      walletId,
      metadata: params.metadata,
    };

    const result = await retryWithBackoff(
      () => this.post<DfnsApiSignResponse>(url, body, params.externalId),
      { maxRetries: this.maxRetries },
    );

    return {
      dfnsRequestId: result.dfnsRequestId,
      signedPsbtBase64: result.signedPsbt,
      signerMeta: result.signerMeta,
      alreadyExists: result.error === 'ALREADY_EXISTS' ? true : undefined,
    };
  }

  /**
   * Query DFNS for the status of a signing request.
   */
  async getRequestStatus(dfnsRequestId: string): Promise<RequestStatusResult> {
    const url = `${this.baseUrl}/requests/${dfnsRequestId}`;

    const result = await retryWithBackoff(
      () => this.get<Record<string, unknown>>(url),
      { maxRetries: this.maxRetries },
    );

    return {
      status: result['status'] as string,
      dfnsTxId: result['txId'] as string | undefined,
      raw: result,
    };
  }

  /**
   * Verify a DFNS webhook signature using HMAC-SHA256.
   */
  verifyWebhookSignature(
    rawBody: Buffer | string,
    signatureHeader: string,
    secret?: string,
  ): boolean {
    const webhookSecret = secret ?? '';
    if (!webhookSecret) {
      this.logger.warn('No webhook secret provided for signature verification');
      return false;
    }
    return verifyHmacSignature(rawBody, signatureHeader, webhookSecret);
  }

  /**
   * Parse and verify a DFNS webhook payload.
   * Throws if the signature is invalid.
   */
  parseAndVerifyWebhook(
    rawBody: Buffer | string,
    signatureHeader: string,
    secret?: string,
  ): WebhookPayload {
    if (!this.verifyWebhookSignature(rawBody, signatureHeader, secret)) {
      throw new DfnsPermanentError('Invalid webhook signature', 401);
    }

    const parsed: Record<string, unknown> =
      typeof rawBody === 'string'
        ? JSON.parse(rawBody) as Record<string, unknown>
        : JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>;

    return {
      externalId: parsed['externalId'] as string,
      dfnsRequestId: parsed['dfnsRequestId'] as string | undefined,
      status: parsed['status'] as string,
      dfnsTxId: parsed['dfnsTxId'] as string | undefined,
      raw: parsed,
    };
  }

  // ─── HTTP helpers ──────────────────────────────────────

  private buildHeaders(idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-DFNS-App': this.appId,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return headers;
  }

  private async post<T>(
    url: string,
    body: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const fetchOpts: RequestInit & { dispatcher?: unknown } = {
      method: 'POST',
      headers: this.buildHeaders(idempotencyKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    };

    // Attach https agent for mTLS if available
    if (this.httpsAgent) {
      (fetchOpts as Record<string, unknown>)['agent'] = this.httpsAgent;
    }

    try {
      const response = await fetch(url, fetchOpts);
      clearTimeout(timer);
      return this.handleResponse<T>(response);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DfnsTransientError || err instanceof DfnsPermanentError) {
        throw err;
      }
      throw new DfnsTransientError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        err instanceof Error ? err : undefined,
      );
    }
  }

  private async get<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const fetchOpts: RequestInit = {
      method: 'GET',
      headers: this.buildHeaders(),
      signal: controller.signal,
    };

    if (this.httpsAgent) {
      (fetchOpts as Record<string, unknown>)['agent'] = this.httpsAgent;
    }

    try {
      const response = await fetch(url, fetchOpts);
      clearTimeout(timer);
      return this.handleResponse<T>(response);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DfnsTransientError || err instanceof DfnsPermanentError) {
        throw err;
      }
      throw new DfnsTransientError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        err instanceof Error ? err : undefined,
      );
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 409) {
      // ALREADY_EXISTS — return existing payload as success
      const data = (await response.json()) as T & { error?: string };
      (data as Record<string, unknown>)['error'] = 'ALREADY_EXISTS';
      return data;
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    const statusCode = response.status;
    const errorText = await response.text().catch(() => 'Unknown error');

    // Transient: 5xx and 429
    if (statusCode >= 500 || statusCode === 429) {
      throw new DfnsTransientError(`DFNS API error: ${statusCode} ${errorText}`, statusCode);
    }

    // Permanent: 4xx (except 409 handled above)
    throw new DfnsPermanentError(`DFNS API error: ${statusCode} ${errorText}`, statusCode);
  }
}
