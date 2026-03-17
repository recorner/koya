export { directus, publicDirectusUrl, assetUrl } from './client';
export type {
  CmsSchema,
  Page,
  PageSection,
  SectionType,
  GlobalSettings,
  NavItem,
  FooterColumn,
  FooterLink,
  FaqItem,
  LegalPage,
  SeoDefaults,
} from './types';
export {
  getGlobalSettings,
  getNavigation,
  getFooterColumns,
  getPageBySlug,
  getSeoDefaults,
  getFaqItems,
  getLegalPage,
  getLegalPages,
} from './queries';
