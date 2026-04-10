import fs from 'fs/promises';
import path from 'path';
import type {
  GlobalSettings,
  SeoDefaults,
  NavItem,
  FooterColumn,
  Page,
  PageSection,
  FaqItem,
  LegalPage,
  WhatsAppPreviewLink,
  SectionType,
} from './types';

/**
 * Content root — relative to the Next.js app directory.
 * At build time and runtime (ISR), Next.js runs from `apps/web/`.
 */
const CONTENT_ROOT = path.join(process.cwd(), 'content');

/** Read and parse a JSON file, returning fallback on error. */
async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Recursively read all JSON files in a directory. */
async function readJsonDir<T>(dirPath: string): Promise<T[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items: T[] = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const raw = await fs.readFile(path.join(dirPath, entry.name), 'utf-8');
        items.push(JSON.parse(raw) as T);
      }
    }
    return items;
  } catch {
    return [];
  }
}

/** Read an MDX file and extract frontmatter + body content. */
async function readMdx(
  filePath: string,
): Promise<{ frontmatter: Record<string, unknown>; content: string } | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fmMatch || !fmMatch[1] || !fmMatch[2]) return null;

    const frontmatter: Record<string, unknown> = {};
    for (const line of fmMatch[1].split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let value: unknown = line.slice(colonIdx + 1).trim();
        // Strip quotes
        if (
          typeof value === 'string' &&
          value.startsWith('"') &&
          value.endsWith('"')
        ) {
          value = value.slice(1, -1);
        }
        if (
          typeof value === 'string' &&
          value.startsWith("'") &&
          value.endsWith("'")
        ) {
          value = value.slice(1, -1);
        }
        frontmatter[key] = value;
      }
    }

    return { frontmatter, content: fmMatch[2].trim() };
  } catch {
    return null;
  }
}

// ─── Singleton Queries ──────────────────────────────────────────────────────

export async function getGlobalSettings(): Promise<GlobalSettings | null> {
  const data = await readJson<Record<string, unknown> | null>(
    path.join(CONTENT_ROOT, 'settings', 'global.json'),
    null,
  );
  if (!data) return null;
  return {
    id: 1,
    site_name: (data.site_name as string) || '',
    site_tagline: (data.site_tagline as string) || '',
    site_description: (data.site_description as string) || '',
    og_image: (data.og_image as string) || null,
    default_meta_title: (data.default_meta_title as string) || '',
    default_meta_description: (data.default_meta_description as string) || '',
    social_x_url: (data.social_x_url as string) || null,
    social_discord_url: (data.social_discord_url as string) || null,
    social_github_url: (data.social_github_url as string) || null,
    contact_email: (data.contact_email as string) || null,
  };
}

export async function getSeoDefaults(): Promise<SeoDefaults | null> {
  const data = await readJson<Record<string, unknown> | null>(
    path.join(CONTENT_ROOT, 'settings', 'seo.json'),
    null,
  );
  if (!data) return null;
  return {
    id: 1,
    title_suffix: (data.title_suffix as string) || null,
    fallback_title: (data.fallback_title as string) || null,
    fallback_description: (data.fallback_description as string) || null,
    fallback_og_image: (data.fallback_og_image as string) || null,
    robots_txt: (data.robots_txt as string) || null,
  };
}

// ─── Collection Queries ─────────────────────────────────────────────────────

export async function getNavigation(): Promise<NavItem[]> {
  const data = await readJson<{ items?: unknown[] } | null>(
    path.join(CONTENT_ROOT, 'settings', 'navigation.json'),
    null,
  );
  if (!data?.items || !Array.isArray(data.items)) return [];
  return (data.items as Record<string, unknown>[])
    .map((item, idx) => ({
      id: idx + 1,
      label: (item.label as string) || '',
      href: (item.href as string) || '',
      sort: (item.sort as number) ?? idx,
      is_cta: Boolean(item.is_cta),
    }))
    .sort((a, b) => a.sort - b.sort);
}

export async function getFooterColumns(): Promise<FooterColumn[]> {
  const data = await readJson<{ columns?: unknown[] } | null>(
    path.join(CONTENT_ROOT, 'settings', 'footer.json'),
    null,
  );
  if (!data?.columns || !Array.isArray(data.columns)) return [];
  return (data.columns as Record<string, unknown>[])
    .map((col, colIdx) => ({
      id: colIdx + 1,
      title: (col.title as string) || '',
      sort: (col.sort as number) ?? colIdx,
      links: Array.isArray(col.links)
        ? (col.links as Record<string, unknown>[]).map((link, linkIdx) => ({
            id: linkIdx + 1,
            label: (link.label as string) || '',
            href: (link.href as string) || '',
            sort: (link.sort as number) ?? linkIdx,
            column_id: colIdx + 1,
          }))
        : [],
    }))
    .sort((a, b) => a.sort - b.sort);
}

export async function getFaqItems(category?: string): Promise<FaqItem[]> {
  const items = await readJsonDir<Record<string, unknown>>(
    path.join(CONTENT_ROOT, 'faq'),
  );
  return items
    .map((item, idx) => ({
      id: idx + 1,
      question: (item.question as string) || '',
      answer: (item.answer as string) || '',
      sort: (item.sort as number) ?? idx,
      category: (item.category as string) || null,
    }))
    .filter((item) => !category || item.category === category)
    .sort((a, b) => a.sort - b.sort);
}

// ─── Page Queries ───────────────────────────────────────────────────────────

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const pagesDir = path.join(CONTENT_ROOT, 'pages');
  try {
    const entries = await fs.readdir(pagesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const raw = await fs.readFile(path.join(pagesDir, entry.name), 'utf-8');
      const data = JSON.parse(raw) as Record<string, unknown>;
      if (data.slug !== slug) continue;
      if (data.status && data.status !== 'published') continue;

      const sections = Array.isArray(data.sections)
        ? (data.sections as Record<string, unknown>[]).map(
            (s, idx) => ({
              id: idx + 1,
              page_id: 1,
              sort: idx,
              section_type: (s._template as SectionType) || 'rich_text',
              heading: (s.heading as string) || null,
              subheading: (s.subheading as string) || null,
              body: (s.body as string) || null,
              badge_text: (s.badge_text as string) || null,
              cta_label: (s.cta_label as string) || null,
              cta_href: (s.cta_href as string) || null,
              cta_secondary_label:
                (s.cta_secondary_label as string) || null,
              cta_secondary_href:
                (s.cta_secondary_href as string) || null,
              items: null,
              config: null,
              background_image: (s.background_image as string) || null,
            }),
          )
        : [];

      return {
        id: 1,
        title: (data.title as string) || '',
        slug: (data.slug as string) || '',
        status: (data.status as 'published' | 'draft' | 'archived') || 'published',
        meta_title: (data.meta_title as string) || null,
        meta_description: (data.meta_description as string) || null,
        sections,
      };
    }
  } catch {
    // directory doesn't exist or read error
  }
  return null;
}

// ─── Legal Page Queries ─────────────────────────────────────────────────────

export async function getLegalPage(slug: string): Promise<LegalPage | null> {
  const legalDir = path.join(CONTENT_ROOT, 'legal');
  try {
    const entries = await fs.readdir(legalDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.mdx')) continue;
      const result = await readMdx(path.join(legalDir, entry.name));
      if (!result) continue;
      const { frontmatter, content } = result;
      if (frontmatter.slug !== slug) continue;
      if (frontmatter.status && frontmatter.status !== 'published') continue;

      return {
        id: 1,
        title: (frontmatter.title as string) || '',
        slug: (frontmatter.slug as string) || '',
        content,
        status: (frontmatter.status as 'published' | 'draft') || 'published',
        meta_title: (frontmatter.meta_title as string) || null,
        meta_description: (frontmatter.meta_description as string) || null,
        updated_at: (frontmatter.updated_at as string) || null,
      };
    }
  } catch {
    // directory doesn't exist or read error
  }
  return null;
}

export async function getLegalPages(): Promise<
  Pick<LegalPage, 'title' | 'slug'>[]
> {
  const legalDir = path.join(CONTENT_ROOT, 'legal');
  const results: Pick<LegalPage, 'title' | 'slug'>[] = [];
  try {
    const entries = await fs.readdir(legalDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.mdx')) continue;
      const result = await readMdx(path.join(legalDir, entry.name));
      if (!result) continue;
      const { frontmatter } = result;
      if (frontmatter.status && frontmatter.status !== 'published') continue;
      results.push({
        title: (frontmatter.title as string) || '',
        slug: (frontmatter.slug as string) || '',
      });
    }
  } catch {
    // directory doesn't exist
  }
  return results.sort((a, b) => a.title.localeCompare(b.title));
}

// ─── WhatsApp Preview Link Queries ──────────────────────────────────────────

export async function getWhatsAppPreviewLink(
  key: string,
): Promise<WhatsAppPreviewLink | null> {
  const items = await readJsonDir<Record<string, unknown>>(
    path.join(CONTENT_ROOT, 'whatsapp-preview-links'),
  );
  for (const item of items) {
    if (item.key === key && item.is_active !== false) {
      return {
        id: 1,
        key: (item.key as string) || '',
        og_title: (item.og_title as string) || '',
        og_description: (item.og_description as string) || '',
        og_image: (item.og_image as string) || null,
        url_path: (item.url_path as string) || '',
        is_active: item.is_active !== false,
      };
    }
  }
  return null;
}
