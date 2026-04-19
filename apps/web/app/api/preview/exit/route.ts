import { NextRequest, NextResponse } from 'next/server';
import { draftMode } from 'next/headers';

import { sanitizeInternalPath } from '@/lib/cms/path-utils';

export async function GET(request: NextRequest) {
  const state = await draftMode();
  state.disable();

  const path = sanitizeInternalPath(request.nextUrl.searchParams.get('path')) || '/';
  return NextResponse.redirect(new URL(path, request.url));
}
