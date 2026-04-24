import type { PageSection } from '@/lib/cms/types';

export interface SectionCta {
  label: string;
  href: string;
}

export interface MarketingSectionContent {
  heading?: string;
  subheading?: string;
  badge?: string;
  body?: string;
  cta?: SectionCta;
  secondaryCta?: SectionCta;
  items?: Record<string, unknown>[];
  config?: Record<string, unknown>;
}

export function normalizeSectionContent(
  section: PageSection | undefined,
): MarketingSectionContent {
  if (!section) {
    return {};
  }

  const cta =
    section.cta_label && section.cta_href
      ? { label: section.cta_label, href: section.cta_href }
      : undefined;

  const secondaryCta =
    section.cta_secondary_label && section.cta_secondary_href
      ? { label: section.cta_secondary_label, href: section.cta_secondary_href }
      : undefined;

  return {
    heading: section.heading || undefined,
    subheading: section.subheading || undefined,
    badge: section.badge_text || undefined,
    body: section.body || undefined,
    cta,
    secondaryCta,
    items: section.items || undefined,
    config: section.config || undefined,
  };
}
