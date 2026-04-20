import { createHash } from 'crypto';

export function checksumPayload(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

export function buildIdempotencyKey(parts: Array<string | null | undefined>): string {
  return createHash('sha256')
    .update(parts.filter(Boolean).join('|'))
    .digest('hex');
}

export function asStringArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function firstHeader(
  headers: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const direct = headers[key] ?? headers[key.toLowerCase()];
  if (!direct) return undefined;
  return Array.isArray(direct) ? direct[0] : direct;
}

export function redactForLogs(payload: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...payload };
  const sensitive = [
    'token',
    'access_token',
    'authorization',
    'phone',
    'phone_number',
    'document',
    'documentNumber',
    'signature',
  ];

  for (const key of Object.keys(clone)) {
    if (sensitive.some((part) => key.toLowerCase().includes(part.toLowerCase()))) {
      clone[key] = '[REDACTED]';
    }
  }

  return clone;
}

export function backoffDelayMs(attempt: number, baseMs: number): number {
  const exp = Math.min(attempt, 6);
  const jitter = Math.floor(Math.random() * 250);
  return baseMs * 2 ** exp + jitter;
}
