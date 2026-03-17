// ─── Directus CMS Types for Koya Marketing Site ────────────────────────────
// These types mirror the Directus collections created for the public site.
// Only marketing/public content — no core banking types here.

export type SectionType =
  | 'hero'
  | 'feature_grid'
  | 'stats'
  | 'how_it_works'
  | 'security'
  | 'cards'
  | 'global_finance'
  | 'faq'
  | 'cta'
  | 'rich_text'
  | 'final_cta'
  | 'swap_widget'
  | 'market_ribbon';

export interface PageSection {
  id: number;
  page_id: number;
  sort: number;
  section_type: SectionType;
  heading: string | null;
  subheading: string | null;
  body: string | null;
  badge_text: string | null;
  cta_label: string | null;
  cta_href: string | null;
  cta_secondary_label: string | null;
  cta_secondary_href: string | null;
  items: Record<string, unknown>[] | null;
  config: Record<string, unknown> | null;
  background_image: string | null;
}

export interface Page {
  id: number;
  title: string;
  slug: string;
  status: 'published' | 'draft' | 'archived';
  meta_title: string | null;
  meta_description: string | null;
  sections: PageSection[] | number[];
}

export interface GlobalSettings {
  id: number;
  site_name: string;
  site_tagline: string;
  site_description: string;
  og_image: string | null;
  default_meta_title: string;
  default_meta_description: string;
  social_x_url: string | null;
  social_discord_url: string | null;
  social_github_url: string | null;
  contact_email: string | null;
}

export interface NavItem {
  id: number;
  label: string;
  href: string;
  sort: number;
  is_cta: boolean;
}

export interface FooterLink {
  id: number;
  label: string;
  href: string;
  sort: number;
  column_id: number;
}

export interface FooterColumn {
  id: number;
  title: string;
  sort: number;
  links: FooterLink[] | number[];
}

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  sort: number;
  category: string | null;
}

export interface LegalPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  status: 'published' | 'draft';
  meta_title: string | null;
  meta_description: string | null;
  updated_at: string | null;
}

export interface SeoDefaults {
  id: number;
  title_suffix: string | null;
  fallback_title: string | null;
  fallback_description: string | null;
  fallback_og_image: string | null;
  robots_txt: string | null;
}

/** Directus SDK schema type map. */
export interface CmsSchema {
  global_settings: GlobalSettings[];
  navigation: NavItem[];
  footer_columns: FooterColumn[];
  footer_links: FooterLink[];
  pages: Page[];
  page_sections: PageSection[];
  faq_items: FaqItem[];
  legal_pages: LegalPage[];
  seo_defaults: SeoDefaults[];
}
