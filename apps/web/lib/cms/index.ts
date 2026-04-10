export type {
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
  WhatsAppPreviewLink,
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
  getWhatsAppPreviewLink,
} from './queries';
