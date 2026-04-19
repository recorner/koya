import { draftMode } from 'next/headers';

import type {
  Branding,
  FaqItem,
  FooterColumn,
  GlobalSettings,
  LegalPage,
  NavItem,
  Page,
  PageSection,
  SeoDefaults,
  SectionType,
  WhatsAppPreviewLink,
} from './types';
import { normalizeInternalPath } from './path-utils';

type JsonRecord = Record<string, unknown>;

type PayloadListResponse<T> = {
  docs?: T[];
};

type FetchConfig = {
  draftCapable?: boolean;
  params?: Record<string, string | number | boolean | undefined>;
  tags: string[];
};

const PAYLOAD_TIMEOUT_MS = Number(process.env.PAYLOAD_TIMEOUT_MS || 5000);
const LOGIN_SKEW_MS = 30_000;

const THEME_TOKEN_MAP: Record<string, string> = {
  'gold-500': '#D4AF37',
  'gold-600': '#A88520',
  'cyan-500': '#00E5FF',
  'emerald-500': '#10B981',
  'slate-900': '#0F172A',
  'slate-950': '#020617',
  'neutral-100': '#F5F5F5',
  'neutral-900': '#171717',
};

const BLOCK_TO_SECTION_TYPE: Record<string, SectionType> = {
  marketRibbon: 'market_ribbon',
  hero: 'hero',
  guestWidgetEmbed: 'swap_widget',
  trustStrip: 'stats',
  featureGrid: 'feature_grid',
  howItWorks: 'how_it_works',
  security: 'security',
  cards: 'cards',
  globalFinance: 'global_finance',
  finalCta: 'final_cta',
  convertHero: 'swap_widget',
  trustFooterItems: 'trust_footer_items',
  richTextContent: 'rich_text',
  mediaShowcase: 'rich_text',
  cta: 'cta',
};

let previewAuthToken: { expiresAt: number; token: string } | null = null;
let previewAuthInFlight: Promise<string | null> | null = null;

function getPayloadApiBase(): string | null {
  const raw = process.env.PAYLOAD_API_URL || process.env.PAYLOAD_BASE_URL;
  if (!raw) return null;

  const trimmed = raw.replace(/\/+$/, '');
  if (trimmed.endsWith('/api')) {
    return trimmed;
  }

  return `${trimmed}/api`;
}

function getPayloadOrigin(): string | null {
  const apiBase = getPayloadApiBase();
  if (!apiBase) return null;

  try {
    return new URL(apiBase).origin;
  } catch {
    return null;
  }
}

function toRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function mapPageStatus(status: string | null): Page['status'] {
  if (status === 'published' || status === 'draft' || status === 'archived') {
    return status;
  }

  return status === 'published' ? 'published' : 'draft';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLexicalNode(node: unknown): string {
  const rec = toRecord(node);
  if (!rec) return '';

  const type = asString(rec.type);
  const children = toArray(rec.children).map((child) => renderLexicalNode(child)).join('');

  switch (type) {
    case 'text': {
      const text = asString(rec.text) || '';
      return escapeHtml(text);
    }
    case 'linebreak':
      return '<br />';
    case 'paragraph':
      return `<p>${children}</p>`;
    case 'heading': {
      const tag = asString(rec.tag);
      const safeTag = tag && /^h[1-6]$/.test(tag) ? tag : 'h2';
      return `<${safeTag}>${children}</${safeTag}>`;
    }
    case 'list': {
      const listType = asString(rec.listType) === 'number' ? 'ol' : 'ul';
      return `<${listType}>${children}</${listType}>`;
    }
    case 'listitem':
      return `<li>${children}</li>`;
    case 'quote':
      return `<blockquote>${children}</blockquote>`;
    case 'link': {
      const rawUrl = asString(rec.url) || '';
      const href = rawUrl.startsWith('/') || /^https?:\/\//i.test(rawUrl) ? rawUrl : '#';
      return `<a href="${escapeHtml(href)}">${children}</a>`;
    }
    case 'root':
      return children;
    default:
      return children;
  }
}

function lexicalToHtml(value: unknown): string {
  const record = toRecord(value);
  if (!record) return '';

  const root = toRecord(record.root);
  if (!root) return '';

  return toArray(root.children).map((child) => renderLexicalNode(child)).join('');
}

function decodeJwtExpiryMs(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) return 0;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as {
      exp?: number;
    };

    if (typeof payload.exp !== 'number') return 0;
    return payload.exp * 1000;
  } catch {
    return 0;
  }
}

async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAYLOAD_TIMEOUT_MS);

  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function shouldUsePreview(): Promise<boolean> {
  try {
    const state = await draftMode();
    return state.isEnabled;
  } catch {
    return false;
  }
}

async function getPreviewAuthToken(): Promise<string | null> {
  const now = Date.now();
  if (previewAuthToken && previewAuthToken.expiresAt - LOGIN_SKEW_MS > now) {
    return previewAuthToken.token;
  }

  if (previewAuthInFlight) {
    return previewAuthInFlight;
  }

  previewAuthInFlight = (async () => {
    const apiBase = getPayloadApiBase();
    const email = process.env.PAYLOAD_PREVIEW_USER_EMAIL;
    const password = process.env.PAYLOAD_PREVIEW_USER_PASSWORD;

    if (!apiBase || !email || !password) {
      return null;
    }

    const url = `${apiBase}/users/login`;

    try {
      const response = await withTimeout((signal) =>
        fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          cache: 'no-store',
          body: JSON.stringify({ email, password }),
          signal,
        }),
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as JsonRecord;
      const token = asString(data.token);
      if (!token) {
        return null;
      }

      const expiresAt = decodeJwtExpiryMs(token);
      previewAuthToken = {
        token,
        expiresAt: expiresAt || Date.now() + 60_000,
      };

      return token;
    } catch {
      return null;
    } finally {
      previewAuthInFlight = null;
    }
  })();

  return previewAuthInFlight;
}

function resolveMediaUrl(value: unknown, preferredSize?: 'og' | 'hero' | 'card' | 'thumbnail'): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) return value;
    const origin = getPayloadOrigin();
    return origin && value.startsWith('/') ? `${origin}${value}` : value;
  }

  const rec = toRecord(value);
  if (!rec) return null;

  if (preferredSize) {
    const sizes = toRecord(rec.sizes);
    const chosen = sizes ? toRecord(sizes[preferredSize]) : null;
    const sizedUrl = asString(chosen?.url);
    if (sizedUrl) {
      return resolveMediaUrl(sizedUrl);
    }
  }

  const rawUrl = asString(rec.url);
  if (!rawUrl) return null;

  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

  const origin = getPayloadOrigin();
  return origin && rawUrl.startsWith('/') ? `${origin}${rawUrl}` : rawUrl;
}

async function payloadFetch<T>(endpoint: string, config: FetchConfig): Promise<T | null> {
  const apiBase = getPayloadApiBase();
  if (!apiBase) return null;

  const preview = await shouldUsePreview();
  const url = new URL(`${apiBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`);

  for (const [key, value] of Object.entries(config.params || {})) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }

  const headers: HeadersInit = {
    accept: 'application/json',
  };

  if (preview && config.draftCapable !== false) {
    const token = await getPreviewAuthToken();
    if (token) {
      url.searchParams.set('draft', 'true');
      headers.authorization = `JWT ${token}`;
    }
  }

  try {
    const response = await withTimeout((signal) =>
      fetch(url.toString(), {
        headers,
        cache: preview ? 'no-store' : 'force-cache',
        ...(preview ? {} : { next: { tags: config.tags } }),
        signal,
      }),
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function toSectionItems(blockType: string, block: JsonRecord): Record<string, unknown>[] | null {
  switch (blockType) {
    case 'trustStrip':
      return toArray(block.signals)
        .map((item) => toRecord(item))
        .filter((item): item is JsonRecord => Boolean(item));
    case 'featureGrid':
      return toArray(block.items)
        .map((item) => toRecord(item))
        .filter((item): item is JsonRecord => Boolean(item));
    case 'howItWorks':
      return toArray(block.steps)
        .map((item) => toRecord(item))
        .filter((item): item is JsonRecord => Boolean(item));
    case 'security':
      return toArray(block.controls)
        .map((item) => toRecord(item))
        .filter((item): item is JsonRecord => Boolean(item));
    case 'cards':
      return toArray(block.features)
        .map((item) => toRecord(item))
        .filter((item): item is JsonRecord => Boolean(item));
    case 'globalFinance':
      return toArray(block.highlights)
        .map((item) => toRecord(item))
        .filter((item): item is JsonRecord => Boolean(item));
    case 'trustFooterItems':
      return toArray(block.items)
        .map((item) => toRecord(item))
        .filter((item): item is JsonRecord => Boolean(item));
    case 'mediaShowcase': {
      return toArray(block.media)
        .map((item) => ({
          alt: asString(toRecord(item)?.alt),
          url: resolveMediaUrl(item, 'card') || resolveMediaUrl(item),
        }))
        .filter((item) => item.url) as Record<string, unknown>[];
    }
    default:
      return null;
  }
}

function toSectionConfig(blockType: string, block: JsonRecord): Record<string, unknown> | null {
  const config: Record<string, unknown> = {};

  const variant = asString(block.variant);
  if (variant) {
    config.variant = variant;
  }

  switch (blockType) {
    case 'marketRibbon': {
      const showLiveRates = asBoolean(block.showLiveRates);
      const tickerMode = asString(block.tickerMode);
      if (showLiveRates !== null) config.showLiveRates = showLiveRates;
      if (tickerMode) config.tickerMode = tickerMode;
      break;
    }
    case 'featureGrid': {
      const columns = asString(block.columns);
      if (columns) config.columns = columns;
      break;
    }
    case 'mediaShowcase': {
      const layout = asString(block.layout);
      if (layout) config.layout = layout;
      break;
    }
    default:
      break;
  }

  return Object.keys(config).length ? config : null;
}

function mapPageSections(pageId: number, sections: unknown): PageSection[] {
  return toArray(sections)
    .map((value, index) => {
      const block = toRecord(value);
      if (!block) return null;

      const blockType = asString(block.blockType) || '';
      const sectionType = BLOCK_TO_SECTION_TYPE[blockType] || 'rich_text';

      const primaryCta = toRecord(block.primaryCta);
      const secondaryCta = toRecord(block.secondaryCta);
      const badge = asString(block.badgeText) || asString(block.eyebrow);

      return {
        id: index + 1,
        page_id: pageId,
        sort: index,
        section_type: sectionType,
        heading: asString(block.heading),
        subheading: asString(block.subheading),
        body:
          blockType === 'richTextContent'
            ? lexicalToHtml(block.body)
            : asString(block.body),
        badge_text: badge,
        cta_label: asString(primaryCta?.label),
        cta_href: asString(primaryCta?.href),
        cta_secondary_label: asString(secondaryCta?.label),
        cta_secondary_href: asString(secondaryCta?.href),
        items: toSectionItems(blockType, block),
        config: toSectionConfig(blockType, block),
        background_image: resolveMediaUrl(block.media, 'hero'),
      } satisfies PageSection;
    })
    .filter((section): section is PageSection => Boolean(section));
}

function mapPage(value: unknown): Page | null {
  const page = toRecord(value);
  if (!page) return null;

  const id = asNumber(page.id) || 0;
  const path = asString(page.path) || '/';
  const seo = toRecord(page.seo);

  return {
    id,
    title: asString(page.title) || '',
    slug: normalizeInternalPath(path),
    status: mapPageStatus(asString(page._status)),
    meta_title: asString(seo?.metaTitle),
    meta_description: asString(seo?.metaDescription),
    og_image: resolveMediaUrl(seo?.ogImage, 'og') || resolveMediaUrl(seo?.ogImage),
    sections: mapPageSections(id || 1, page.sections),
  };
}

function mapLegalPage(value: unknown): LegalPage | null {
  const page = toRecord(value);
  if (!page) return null;

  const seo = toRecord(page.seo);

  return {
    id: asNumber(page.id) || 0,
    title: asString(page.title) || '',
    slug: asString(page.slug) || '',
    content: lexicalToHtml(page.body),
    status: asString(page._status) === 'draft' ? 'draft' : 'published',
    meta_title: asString(seo?.metaTitle),
    meta_description: asString(seo?.metaDescription),
    updated_at: asString(page.lastUpdated) || asString(page.updatedAt),
  };
}

async function getSiteSettingsGlobal(): Promise<JsonRecord | null> {
  return payloadFetch<JsonRecord>('/globals/site-settings', {
    draftCapable: true,
    params: {
      depth: 2,
    },
    tags: ['site-settings'],
  });
}

async function getThemeSettingsGlobal(): Promise<JsonRecord | null> {
  return payloadFetch<JsonRecord>('/globals/theme-settings', {
    draftCapable: true,
    params: {
      depth: 1,
    },
    tags: ['theme-settings'],
  });
}

// ─── Singleton Queries ──────────────────────────────────────────────────────

export async function getGlobalSettings(): Promise<GlobalSettings | null> {
  const data = await getSiteSettingsGlobal();
  if (!data) return null;

  const socialByPlatform = new Map<string, string>();
  for (const item of toArray(data.socialLinks)) {
    const social = toRecord(item);
    if (!social) continue;
    const platform = asString(social.platform);
    const url = asString(social.url);
    if (platform && url) {
      socialByPlatform.set(platform, url);
    }
  }

  return {
    id: asNumber(data.id) || 1,
    site_name: asString(data.siteName) || 'Koya',
    site_tagline: asString(data.siteTagline) || '',
    site_description: asString(data.siteDescription) || '',
    og_image: resolveMediaUrl(data.defaultOgImage, 'og') || resolveMediaUrl(data.defaultOgImage),
    default_meta_title: asString(data.defaultMetaTitle) || '',
    default_meta_description: asString(data.defaultMetaDescription) || '',
    social_x_url: socialByPlatform.get('x') || null,
    social_discord_url: socialByPlatform.get('discord') || null,
    social_github_url: socialByPlatform.get('github') || null,
    contact_email: asString(data.contactEmail),
  };
}

export async function getSeoDefaults(): Promise<SeoDefaults | null> {
  const data = await payloadFetch<JsonRecord>('/globals/seo-defaults', {
    draftCapable: true,
    params: {
      depth: 2,
    },
    tags: ['seo-defaults'],
  });

  if (!data) return null;

  return {
    id: asNumber(data.id) || 1,
    title_suffix: asString(data.titleSuffix),
    fallback_title: asString(data.fallbackTitle),
    fallback_description: asString(data.fallbackDescription),
    fallback_og_image:
      resolveMediaUrl(data.fallbackOgImage, 'og') || resolveMediaUrl(data.fallbackOgImage),
    robots_txt: asString(data.robotsTxt),
  };
}

export async function getBranding(): Promise<Branding | null> {
  const [site, theme] = await Promise.all([
    getSiteSettingsGlobal(),
    getThemeSettingsGlobal(),
  ]);

  if (!site && !theme) return null;

  const primaryToken = asString(theme?.primaryToken || null);
  const backgroundMode = asString(theme?.backgroundMode || null);
  const primaryColor = primaryToken ? THEME_TOKEN_MAP[primaryToken] || null : null;
  const backgroundColor =
    backgroundMode === 'light' ? '#F7F7F5' : backgroundMode === 'dark' ? '#070708' : null;

  return {
    logo_mark: resolveMediaUrl(site?.logoMark) || null,
    logo_icon: resolveMediaUrl(site?.logoIcon) || null,
    apple_icon: resolveMediaUrl(site?.appleIcon) || resolveMediaUrl(site?.logoIcon) || null,
    og_default_image:
      resolveMediaUrl(site?.defaultOgImage, 'og') || resolveMediaUrl(site?.defaultOgImage),
    primary_color: primaryColor,
    background_color: backgroundColor,
    theme_color: backgroundColor || primaryColor,
    company_name: asString(site?.companyName || null),
    tagline: asString(site?.siteTagline || null),
  };
}

// ─── Collection Queries ─────────────────────────────────────────────────────

export async function getNavigation(): Promise<NavItem[]> {
  const data = await payloadFetch<JsonRecord>('/globals/navigation', {
    draftCapable: true,
    params: {
      depth: 2,
    },
    tags: ['navigation'],
  });

  if (!data) return [];

  return toArray(data.items)
    .map((item, index) => {
      const row = toRecord(item);
      const link = toRecord(row?.link);
      if (!row || !link) return null;

      return {
        id: index + 1,
        label: asString(link.label) || '',
        href: asString(link.href) || '/',
        sort: asNumber(row.sortOrder) ?? index,
        is_cta: asBoolean(row.isCta) ?? false,
      } satisfies NavItem;
    })
    .filter((item): item is NavItem => Boolean(item))
    .sort((a, b) => a.sort - b.sort);
}

export async function getFooterColumns(): Promise<FooterColumn[]> {
  const data = await payloadFetch<JsonRecord>('/globals/footer', {
    draftCapable: true,
    params: {
      depth: 2,
    },
    tags: ['footer'],
  });

  if (!data) return [];

  const columns: FooterColumn[] = [];

  for (const [columnIndex, column] of toArray(data.columns).entries()) {
    const col = toRecord(column);
    if (!col) continue;

    const links: FooterColumn['links'] = [];
    for (const [linkIndex, linkRow] of toArray(col.links).entries()) {
      const row = toRecord(linkRow);
      const link = toRecord(row?.link);
      if (!row || !link) continue;

      (links as Exclude<FooterColumn['links'], number[]>).push({
        id: linkIndex + 1,
        label: asString(link.label) || '',
        href: asString(link.href) || '/',
        sort: asNumber(row.sortOrder) ?? linkIndex,
        column_id: columnIndex + 1,
      });
    }

    (links as Exclude<FooterColumn['links'], number[]>).sort(
      (a, b) => a.sort - b.sort,
    );

    columns.push({
      id: columnIndex + 1,
      title: asString(col.title) || '',
      sort: asNumber(col.sortOrder) ?? columnIndex,
      links,
    });
  }

  return columns.sort((a, b) => a.sort - b.sort);
}

export async function getFaqItems(category?: string): Promise<FaqItem[]> {
  const data = await payloadFetch<PayloadListResponse<JsonRecord>>('/faqs', {
    draftCapable: true,
    params: {
      depth: 0,
      limit: 200,
      sort: 'sortOrder',
      'where[isActive][equals]': 'true',
    },
    tags: ['faqs'],
  });

  const docs = data?.docs || [];

  return docs
    .map((doc) => ({
      id: asNumber(doc.id) || 0,
      question: asString(doc.question) || '',
      answer: asString(doc.answer) || '',
      sort: asNumber(doc.sortOrder) || 0,
      category: asString(doc.category),
    }))
    .filter((item) => !category || item.category === category)
    .sort((a, b) => a.sort - b.sort);
}

// ─── Page Queries ───────────────────────────────────────────────────────────

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const normalizedPath = normalizeInternalPath(slug);
  const data = await payloadFetch<PayloadListResponse<JsonRecord>>('/pages', {
    draftCapable: true,
    params: {
      depth: 3,
      limit: 1,
      'where[path][equals]': normalizedPath,
    },
    tags: ['pages', `page:${normalizedPath}`],
  });

  const doc = data?.docs?.[0];
  const mapped = mapPage(doc || null);

  if (!mapped) return null;

  if (!(await shouldUsePreview()) && mapped.status !== 'published') {
    return null;
  }

  return mapped;
}

// ─── Legal Page Queries ─────────────────────────────────────────────────────

export async function getLegalPage(slug: string): Promise<LegalPage | null> {
  const data = await payloadFetch<PayloadListResponse<JsonRecord>>('/legal-pages', {
    draftCapable: true,
    params: {
      depth: 2,
      limit: 1,
      'where[slug][equals]': slug,
    },
    tags: ['legal-pages', `legal:${slug}`],
  });

  const mapped = mapLegalPage(data?.docs?.[0] || null);

  if (!mapped) return null;

  if (!(await shouldUsePreview()) && mapped.status !== 'published') {
    return null;
  }

  return mapped;
}

export async function getLegalPages(): Promise<
  Pick<LegalPage, 'title' | 'slug'>[]
> {
  const data = await payloadFetch<PayloadListResponse<JsonRecord>>('/legal-pages', {
    draftCapable: true,
    params: {
      depth: 0,
      limit: 200,
      sort: 'title',
    },
    tags: ['legal-pages'],
  });

  const preview = await shouldUsePreview();

  return (data?.docs || [])
    .map((doc) => {
      const status = asString(doc._status) || 'published';
      if (!preview && status !== 'published') {
        return null;
      }

      const title = asString(doc.title) || '';
      const slug = asString(doc.slug) || '';
      if (!slug) return null;

      return { title, slug };
    })
    .filter((item): item is Pick<LegalPage, 'title' | 'slug'> => Boolean(item))
    .sort((a, b) => a.title.localeCompare(b.title));
}

// ─── WhatsApp Preview Link Queries ──────────────────────────────────────────

export async function getWhatsAppPreviewLink(
  key: string,
): Promise<WhatsAppPreviewLink | null> {
  const data = await payloadFetch<PayloadListResponse<JsonRecord>>(
    '/whatsapp-preview-links',
    {
      draftCapable: false,
      params: {
        depth: 2,
        limit: 1,
        'where[key][equals]': key,
      },
      tags: ['whatsapp-preview-links', `whatsapp:${key}`],
    },
  );

  const item = data?.docs?.[0];
  const isActive = asBoolean(item?.isActive) ?? true;

  if (!item || !isActive) {
    return null;
  }

  return {
    id: asNumber(item.id) || 0,
    key: asString(item.key) || '',
    og_title: asString(item.ogTitle) || '',
    og_description: asString(item.ogDescription) || '',
    og_image: resolveMediaUrl(item.ogImage, 'og') || resolveMediaUrl(item.ogImage),
    url_path: asString(item.path) || '/',
    is_active: isActive,
  };
}
