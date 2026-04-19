import { NextRequest, NextResponse } from 'next/server';
import { draftMode } from 'next/headers';

import { sanitizeInternalPath } from '@/lib/cms/path-utils';

const PREVIEW_SECRET = process.env.KOYA_PREVIEW_SECRET;

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('previewSecret');
  if (!PREVIEW_SECRET || secret !== PREVIEW_SECRET) {
    return NextResponse.json({ message: 'Invalid preview secret' }, { status: 401 });
  }

  const rawPath = request.nextUrl.searchParams.get('path');
  const path = sanitizeInternalPath(rawPath) || '/';

  // Validate contract params for observability and sanity checks.
  const resourceType = request.nextUrl.searchParams.get('resourceType');
  const resourceSlug = request.nextUrl.searchParams.get('resourceSlug');
  if (!resourceType || !resourceSlug) {
    return NextResponse.json(
      { message: 'Missing preview contract parameters' },
      { status: 400 },
    );
  }

  const state = await draftMode();
  state.enable();

  return NextResponse.redirect(new URL(path, request.url));
}
