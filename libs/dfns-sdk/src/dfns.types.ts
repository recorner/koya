/** DFNS SDK types */

// ─── Client Options ────────────────────────────────────────

export interface DfnsMTlsOptions {
  /** PEM-encoded client certificate */
  cert: string | Buffer;
  /** PEM-encoded client private key */
  key: string | Buffer;
  /** PEM-encoded CA certificate (to verify DFNS server) */
  ca?: string | Buffer;
}

export interface DfnsClientOptions {
  /** DFNS API base URL (e.g. https://api.dfns.ninja/v2) */
  baseUrl: string;
  /** DFNS application ID */
  appId: string;
  /** DFNS wallet ID for signing operations */
  walletId: string;
  /** API key for Authorization header (sandbox fallback) */
  apiKey?: string;
  /** mTLS options — required in staging/production */
  mTlsOptions?: DfnsMTlsOptions;
  /** Max retry attempts for transient errors (default: 5) */
  maxRetries?: number;
  /** Request timeout in milliseconds (default: 15000) */
  timeoutMs?: number;
  /** Optional logger */
  logger?: DfnsLogger;
}

export interface DfnsLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

// ─── Sign PSBT ─────────────────────────────────────────────

export interface SignPsbtParams {
  /** Idempotency key — must be unique per signing request */
  externalId: string;
  /** Base64-encoded unsigned PSBT */
  psbtBase64: string;
  /** Bria batch/psbt ID for tracking */
  psbtId?: string;
  /** Override wallet ID (otherwise uses client default) */
  walletId?: string;
  /** Arbitrary metadata to attach to the request */
  metadata?: Record<string, unknown>;
}

export interface SignPsbtResult {
  /** DFNS-assigned request ID */
  dfnsRequestId: string;
  /** Base64-encoded signed PSBT */
  signedPsbtBase64: string;
  /** Signer metadata */
  signerMeta: {
    signerId: string;
    timestamp: string;
  };
  /** True if this was a duplicate (409 ALREADY_EXISTS) */
  alreadyExists?: boolean;
}

// ─── Request Status ────────────────────────────────────────

export interface RequestStatusResult {
  status: string;
  dfnsTxId?: string;
  raw: Record<string, unknown>;
}

// ─── Webhook ───────────────────────────────────────────────

export interface WebhookPayload {
  externalId: string;
  dfnsRequestId?: string;
  status: string;
  dfnsTxId?: string;
  raw: Record<string, unknown>;
}
