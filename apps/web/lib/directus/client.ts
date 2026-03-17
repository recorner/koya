import { createDirectus, rest, staticToken } from '@directus/sdk';

/**
 * Server-side Directus client.
 * Uses internal URL (localhost) for server components and
 * the static admin token for authenticated reads.
 *
 * NOTE: We intentionally don't pass a schema generic here.
 * The Directus SDK's schema inference causes issues with singleton
 * collections. Instead, we cast return types in query functions.
 */
const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8055';
const directusToken = process.env.DIRECTUS_TOKEN || '';

export const directus = createDirectus(directusUrl)
  .with(staticToken(directusToken))
  .with(rest());

/**
 * Public Directus URL for asset/image references in the browser.
 * Falls back to the server URL if the public one isn't set.
 */
export const publicDirectusUrl =
  process.env.NEXT_PUBLIC_DIRECTUS_URL || directusUrl;

/** Build a public asset URL for a Directus file UUID. */
export function assetUrl(fileId: string | null | undefined): string | null {
  if (!fileId) return null;
  return `${publicDirectusUrl}/assets/${fileId}`;
}
