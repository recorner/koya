const ABSOLUTE_URL_RE = /^https?:\/\//i;

export function normalizeInternalPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  if (trimmed === '/') return '/';

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');
  return withoutTrailingSlash || '/';
}

export function sanitizeInternalPath(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return '/';
  if (ABSOLUTE_URL_RE.test(trimmed) || trimmed.startsWith('//')) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, 'https://koya.local');
  } catch {
    return null;
  }

  const pathname = normalizeInternalPath(parsed.pathname || '/');
  if (!pathname.startsWith('/') || pathname.startsWith('//') || /\s/.test(pathname)) {
    return null;
  }

  const search = parsed.search || '';
  const hash = parsed.hash || '';
  return `${pathname}${search}${hash}`;
}
