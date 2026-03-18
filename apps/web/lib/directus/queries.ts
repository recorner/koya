import { readItems, readSingleton } from '@directus/sdk';
import { directus } from './client';
import type {
  GlobalSettings,
  NavItem,
  FooterColumn,
  Page,
  SeoDefaults,
  FaqItem,
  LegalPage,
  WhatsAppPreviewLink,
} from './types';

// ─── Singleton Queries ──────────────────────────────────────────────────────

export async function getGlobalSettings(): Promise<GlobalSettings | null> {
  try {
    const data = await directus.request(readSingleton('global_settings' as never));
    return data as unknown as GlobalSettings;
  } catch {
    return null;
  }
}

export async function getSeoDefaults(): Promise<SeoDefaults | null> {
  try {
    const data = await directus.request(readSingleton('seo_defaults' as never));
    return data as unknown as SeoDefaults;
  } catch {
    return null;
  }
}

// ─── Collection Queries ─────────────────────────────────────────────────────

export async function getNavigation(): Promise<NavItem[]> {
  try {
    const data = await directus.request(
      readItems('navigation' as never, {
        sort: ['sort'],
        limit: 20,
      } as never)
    );
    return data as unknown as NavItem[];
  } catch {
    return [];
  }
}

export async function getFooterColumns(): Promise<FooterColumn[]> {
  try {
    const data = await directus.request(
      readItems('footer_columns' as never, {
        sort: ['sort'],
        fields: ['*', { links: ['*'] }],
        limit: 10,
      } as never)
    );
    return data as unknown as FooterColumn[];
  } catch {
    return [];
  }
}

export async function getFaqItems(category?: string): Promise<FaqItem[]> {
  try {
    const data = await directus.request(
      readItems('faq_items' as never, {
        sort: ['sort'],
        limit: 100,
        ...(category ? { filter: { category: { _eq: category } } } : {}),
      } as never)
    );
    return data as unknown as FaqItem[];
  } catch {
    return [];
  }
}

// ─── Page Queries ───────────────────────────────────────────────────────────

export async function getPageBySlug(slug: string): Promise<Page | null> {
  try {
    const pages = await directus.request(
      readItems('pages' as never, {
        filter: {
          slug: { _eq: slug },
          status: { _eq: 'published' },
        },
        fields: ['*', { sections: ['*'] }],
        limit: 1,
      } as never)
    ) as unknown as Page[];
    const page = pages[0] ?? null;
    if (page && Array.isArray(page.sections)) {
      (page.sections as { sort: number }[]).sort((a, b) => a.sort - b.sort);
    }
    return page;
  } catch {
    return null;
  }
}

// ─── Legal Page Queries ─────────────────────────────────────────────────────

export async function getLegalPage(slug: string): Promise<LegalPage | null> {
  try {
    const pages = await directus.request(
      readItems('legal_pages' as never, {
        filter: {
          slug: { _eq: slug },
          status: { _eq: 'published' },
        },
        limit: 1,
      } as never)
    ) as unknown as LegalPage[];
    return pages[0] ?? null;
  } catch {
    return null;
  }
}

export async function getLegalPages(): Promise<Pick<LegalPage, 'title' | 'slug'>[]> {
  try {
    const data = await directus.request(
      readItems('legal_pages' as never, {
        filter: { status: { _eq: 'published' } },
        fields: ['title', 'slug'],
        sort: ['title'],
      } as never)
    );
    return data as unknown as Pick<LegalPage, 'title' | 'slug'>[];
  } catch {
    return [];
  }
}

// ─── WhatsApp Preview Link Queries ──────────────────────────────────────────

export async function getWhatsAppPreviewLink(
  key: string,
): Promise<WhatsAppPreviewLink | null> {
  try {
    const data = await directus.request(
      readItems('whatsapp_preview_links' as never, {
        filter: {
          key: { _eq: key },
          is_active: { _eq: true },
        },
        limit: 1,
      } as never),
    ) as unknown as WhatsAppPreviewLink[];
    return data[0] ?? null;
  } catch {
    return null;
  }
}
