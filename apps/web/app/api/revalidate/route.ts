import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

/**
 * On-demand revalidation endpoint for Directus CMS webhooks.
 *
 * When content changes in Directus, a webhook POSTs here with the secret.
 * This purges the ISR cache so the next request gets fresh data instantly.
 *
 * Setup: Create a Directus Flow with trigger "Event Hook" on
 * items.create / items.update / items.delete for all CMS collections,
 * with a "Webhook / Request URL" operation pointing to:
 *   POST https://koyabank.com/api/revalidate
 *   Body: { "secret": "<REVALIDATION_SECRET>" }
 */

const secret = process.env.REVALIDATION_SECRET;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!secret || body.secret !== secret) {
      return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
    }

    // Revalidate the entire public layout tree — covers homepage,
    // dynamic pages, legal pages, and shared header/footer data.
    revalidatePath('/(public)', 'layout');

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch {
    return NextResponse.json(
      { message: 'Error revalidating' },
      { status: 500 },
    );
  }
}
