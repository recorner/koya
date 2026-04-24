import { NextRequest, NextResponse } from 'next/server';

/**
 * Block /admin paths on the public site (koyabank.com / www.koyabank.com).
 * Internal admin paths are not exposed publicly.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const isPublicHost =
    host === 'koyabank.com' ||
    host === 'www.koyabank.com' ||
    host.endsWith('.vercel.app');

  if (isPublicHost && request.nextUrl.pathname.startsWith('/admin')) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
