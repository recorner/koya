import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import {
  resolveRevalidationTargets,
  type RevalidatePayload,
  verifyWebhookSignature,
} from '@/lib/cms/revalidate';

const WEBHOOK_SECRET = process.env.KOYA_REVALIDATE_WEBHOOK_SECRET;
const MAX_SKEW_MS = Number(process.env.KOYA_REVALIDATE_MAX_SKEW_MS || 5 * 60 * 1000);

function badRequest(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    return badRequest('Webhook secret is not configured', 500);
  }

  const eventHeader = request.headers.get('x-koya-event') || '';
  const timestampHeader = request.headers.get('x-koya-timestamp') || '';
  const signatureHeader = request.headers.get('x-koya-signature') || '';

  const rawBody = await request.text();
  if (!rawBody) {
    return badRequest('Missing body');
  }

  const verified = verifyWebhookSignature({
    rawBody,
    secret: WEBHOOK_SECRET,
    signature: signatureHeader,
    timestamp: timestampHeader,
    maxSkewMs: MAX_SKEW_MS,
  });

  if (!verified.ok) {
    return badRequest(`Signature verification failed: ${verified.reason}`, 401);
  }

  let payload: RevalidatePayload;
  try {
    payload = JSON.parse(rawBody) as RevalidatePayload;
  } catch {
    return badRequest('Invalid JSON payload');
  }

  if (!payload?.eventType || !payload.resource?.slug || !payload.resource?.type) {
    return badRequest('Invalid revalidation payload schema');
  }

  if (eventHeader && eventHeader !== payload.eventType) {
    return badRequest('Event header mismatch', 401);
  }

  const { paths, tags } = resolveRevalidationTargets(payload);

  for (const tag of tags) {
    revalidateTag(tag, 'max');
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({
    acknowledged: true,
    eventType: payload.eventType,
    paths,
    resource: payload.resource,
    tags,
  });
}
