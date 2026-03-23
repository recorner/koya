/** DFNS SDK error types */

export class DfnsTransientError extends Error {
  readonly isTransient = true;
  readonly statusCode?: number;

  constructor(
    message: string,
    statusCode?: number,
    override readonly cause?: Error,
  ) {
    super(message);
    this.name = 'DfnsTransientError';
    this.statusCode = statusCode;
  }
}

export class DfnsPermanentError extends Error {
  readonly isTransient = false;
  readonly statusCode?: number;

  constructor(
    message: string,
    statusCode?: number,
    override readonly cause?: Error,
  ) {
    super(message);
    this.name = 'DfnsPermanentError';
    this.statusCode = statusCode;
  }
}

