import * as grpc from '@grpc/grpc-js';

/** Error codes matching gRPC status codes relevant to Bria */
export enum BriaErrorCode {
  UNAVAILABLE = 'UNAVAILABLE',
  DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  INTERNAL = 'INTERNAL',
  UNKNOWN = 'UNKNOWN',
}

const GRPC_STATUS_TO_CODE: Record<number, BriaErrorCode> = {
  [grpc.status.UNAVAILABLE]: BriaErrorCode.UNAVAILABLE,
  [grpc.status.DEADLINE_EXCEEDED]: BriaErrorCode.DEADLINE_EXCEEDED,
  [grpc.status.NOT_FOUND]: BriaErrorCode.NOT_FOUND,
  [grpc.status.ALREADY_EXISTS]: BriaErrorCode.ALREADY_EXISTS,
  [grpc.status.PERMISSION_DENIED]: BriaErrorCode.PERMISSION_DENIED,
  [grpc.status.UNAUTHENTICATED]: BriaErrorCode.UNAUTHENTICATED,
  [grpc.status.INTERNAL]: BriaErrorCode.INTERNAL,
};

/** Transient error codes that should trigger a retry */
const TRANSIENT_CODES = new Set<BriaErrorCode>([
  BriaErrorCode.UNAVAILABLE,
  BriaErrorCode.DEADLINE_EXCEEDED,
]);

export class BriaClientError extends Error {
  constructor(
    public readonly code: BriaErrorCode,
    message: string,
    public readonly grpcCode?: number,
  ) {
    super(message);
    this.name = 'BriaClientError';
  }

  get isTransient(): boolean {
    return TRANSIENT_CODES.has(this.code);
  }

  static fromGrpcError(err: { code?: number; message?: string; details?: string }): BriaClientError {
    const grpcCode = err.code ?? grpc.status.UNKNOWN;
    const code = GRPC_STATUS_TO_CODE[grpcCode] ?? BriaErrorCode.UNKNOWN;
    const message = err.details ?? err.message ?? 'Unknown gRPC error';
    return new BriaClientError(code, message, grpcCode);
  }
}
