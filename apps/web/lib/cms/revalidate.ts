import { createHmac, timingSafeEqual } from 'crypto';

import { sanitizeInternalPath } from './path-utils';

export type RevalidateResource = {
  id?: number | string;
  path?: string | null;
  slug: string;
  status?: string | null;
  type: 'collection' | 'global';
};

export type RevalidatePayload = {
  actor?: {
    id?: number | string;
    role?: string;
  };
  eventType: string;
  occurredAt: string;
  paths?: string[];
  resource: RevalidateResource;
  tags?: string[];
};

function safeEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return timingSafeEqual(aBuf, bBuf);
}

export function verifyWebhookSignature(args: {
  rawBody: string;
  secret: string;
  signature: string;
  timestamp: string;
  maxSkewMs: number;
  nowMs?: number;
}): { ok: true } | { ok: false; reason: string } {
  const { rawBody, secret, signature, timestamp, maxSkewMs } = args;
  const nowMs = args.nowMs ?? Date.now();

  if (!signature || !timestamp) {
    return { ok: false, reason: 'missing_headers' };
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }

  if (Math.abs(nowMs - timestampMs) > maxSkewMs) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  if (!safeEqualHex(expected, signature)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  return { ok: true };
}

function fallbackPaths(resource: RevalidateResource): string[] {
  if (resource.type === 'collection') {
    switch (resource.slug) {
      case 'pages':
        return [sanitizeInternalPath(resource.path || '/') || '/'];
      case 'legal-pages':
        return [sanitizeInternalPath(resource.path || '/') || '/'];
      case 'faqs':
      case 'whatsapp-preview-links':
        return ['/'];
      default:
        return [];
    }
  }

  // Globals
  return ['/'];
}

function fallbackTags(resource: RevalidateResource): string[] {
  if (resource.type === 'collection') {
    switch (resource.slug) {
      case 'pages': {
        const pathTag = sanitizeInternalPath(resource.path || '/');
        return pathTag ? ['pages', `page:${pathTag}`] : ['pages'];
      }
      case 'legal-pages': {
        const slug = (resource.path || '').split('/').filter(Boolean).pop();
        return slug ? ['legal-pages', `legal:${slug}`] : ['legal-pages'];
      }
      case 'faqs':
        return ['faqs'];
      case 'whatsapp-preview-links':
        return ['whatsapp-preview-links'];
      default:
        return [resource.slug];
    }
  }

  if (resource.slug === 'site-settings') {
    return ['site-settings', 'navigation', 'footer'];
  }

  return [resource.slug];
}

export function resolveRevalidationTargets(payload: RevalidatePayload): {
  paths: string[];
  tags: string[];
} {
  const rawPaths = payload.paths?.length
    ? payload.paths
    : fallbackPaths(payload.resource);
  const rawTags = payload.tags?.length
    ? payload.tags
    : fallbackTags(payload.resource);

  const paths = [
    ...new Set(
      rawPaths
        .map((p) => sanitizeInternalPath(p))
        .filter((p): p is string => Boolean(p))
        .map((p) => {
          const url = new URL(p, 'https://koya.local');
          return url.pathname;
        }),
    ),
  ];
  const tags = [...new Set(rawTags.map((tag) => tag?.trim()).filter((tag): tag is string => Boolean(tag)))];

  return { paths, tags };
}
