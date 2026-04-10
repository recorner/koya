import { defineConfig } from 'tinacms';
import { KoyaAuthProvider } from './auth/frontend';

/**
 * Page section templates — maps the current Directus section_type system
 * into Tina's structured block/template system.
 */
const sectionTemplates = [
  'hero',
  'feature_grid',
  'stats',
  'how_it_works',
  'security',
  'cards',
  'global_finance',
  'faq',
  'cta',
  'rich_text',
  'final_cta',
  'swap_widget',
  'market_ribbon',
].map((sectionType) => ({
  name: sectionType,
  label: sectionType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '),
  fields: [
    { name: 'heading', label: 'Heading', type: 'string' as const },
    { name: 'subheading', label: 'Subheading', type: 'string' as const },
    {
      name: 'body',
      label: 'Body',
      type: 'string' as const,
      ui: { component: 'textarea' },
    },
    { name: 'badge_text', label: 'Badge Text', type: 'string' as const },
    { name: 'cta_label', label: 'CTA Label', type: 'string' as const },
    { name: 'cta_href', label: 'CTA Href', type: 'string' as const },
    {
      name: 'cta_secondary_label',
      label: 'CTA Secondary Label',
      type: 'string' as const,
    },
    {
      name: 'cta_secondary_href',
      label: 'CTA Secondary Href',
      type: 'string' as const,
    },
    {
      name: 'background_image',
      label: 'Background Image',
      type: 'image' as const,
    },
  ],
}));

const config = defineConfig({
  contentApiUrlOverride: '/api/tina/gql',
  authProvider: new KoyaAuthProvider(),
  branch: process.env.TINA_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main',

  build: {
    outputFolder: 'admin',
    publicFolder: 'public',
  },

  media: {
    tina: {
      publicFolder: 'public',
      mediaRoot: 'uploads',
    },
  },

  schema: {
    collections: [
      // ─── Singleton-style Documents ────────────────────────────────────
      {
        name: 'globalSettings',
        label: 'Global Settings',
        path: 'content/settings',
        format: 'json',
        match: { include: 'global' },
        ui: { allowedActions: { create: false, delete: false } },
        fields: [
          { name: 'site_name', label: 'Site Name', type: 'string', required: true },
          { name: 'site_tagline', label: 'Site Tagline', type: 'string' },
          {
            name: 'site_description',
            label: 'Site Description',
            type: 'string',
            ui: { component: 'textarea' },
          },
          { name: 'og_image', label: 'OG Image', type: 'image' },
          {
            name: 'default_meta_title',
            label: 'Default Meta Title',
            type: 'string',
          },
          {
            name: 'default_meta_description',
            label: 'Default Meta Description',
            type: 'string',
          },
          { name: 'social_x_url', label: 'X (Twitter) URL', type: 'string' },
          { name: 'social_discord_url', label: 'Discord URL', type: 'string' },
          { name: 'social_github_url', label: 'GitHub URL', type: 'string' },
          { name: 'contact_email', label: 'Contact Email', type: 'string' },
        ],
      },
      {
        name: 'seoDefaults',
        label: 'SEO Defaults',
        path: 'content/settings',
        format: 'json',
        match: { include: 'seo' },
        ui: { allowedActions: { create: false, delete: false } },
        fields: [
          { name: 'title_suffix', label: 'Title Suffix', type: 'string' },
          { name: 'fallback_title', label: 'Fallback Title', type: 'string' },
          {
            name: 'fallback_description',
            label: 'Fallback Description',
            type: 'string',
          },
          {
            name: 'fallback_og_image',
            label: 'Fallback OG Image',
            type: 'image',
          },
          {
            name: 'robots_txt',
            label: 'Robots.txt Content',
            type: 'string',
            ui: { component: 'textarea' },
          },
        ],
      },
      {
        name: 'navigation',
        label: 'Navigation',
        path: 'content/settings',
        format: 'json',
        match: { include: 'navigation' },
        ui: { allowedActions: { create: false, delete: false } },
        fields: [
          {
            name: 'items',
            label: 'Nav Items',
            type: 'object',
            list: true,
            fields: [
              { name: 'label', label: 'Label', type: 'string', required: true },
              { name: 'href', label: 'Href', type: 'string', required: true },
              { name: 'sort', label: 'Sort Order', type: 'number' },
              { name: 'is_cta', label: 'Is CTA?', type: 'boolean' },
            ],
          },
        ],
      },
      {
        name: 'footer',
        label: 'Footer',
        path: 'content/settings',
        format: 'json',
        match: { include: 'footer' },
        ui: { allowedActions: { create: false, delete: false } },
        fields: [
          {
            name: 'columns',
            label: 'Footer Columns',
            type: 'object',
            list: true,
            fields: [
              {
                name: 'title',
                label: 'Column Title',
                type: 'string',
                required: true,
              },
              { name: 'sort', label: 'Sort Order', type: 'number' },
              {
                name: 'links',
                label: 'Links',
                type: 'object',
                list: true,
                fields: [
                  {
                    name: 'label',
                    label: 'Label',
                    type: 'string',
                    required: true,
                  },
                  {
                    name: 'href',
                    label: 'Href',
                    type: 'string',
                    required: true,
                  },
                  { name: 'sort', label: 'Sort Order', type: 'number' },
                ],
              },
            ],
          },
        ],
      },

      // ─── Content Collections ──────────────────────────────────────────
      {
        name: 'page',
        label: 'Pages',
        path: 'content/pages',
        format: 'json',
        fields: [
          { name: 'title', label: 'Title', type: 'string', required: true },
          { name: 'slug', label: 'Slug', type: 'string', required: true },
          {
            name: 'status',
            label: 'Status',
            type: 'string',
            options: ['published', 'draft', 'archived'],
          },
          { name: 'meta_title', label: 'Meta Title', type: 'string' },
          {
            name: 'meta_description',
            label: 'Meta Description',
            type: 'string',
          },
          {
            name: 'sections',
            label: 'Page Sections',
            type: 'object',
            list: true,
            templates: sectionTemplates,
          },
        ],
      },
      {
        name: 'legalPage',
        label: 'Legal Pages',
        path: 'content/legal',
        format: 'mdx',
        fields: [
          { name: 'title', label: 'Title', type: 'string', required: true },
          { name: 'slug', label: 'Slug', type: 'string', required: true },
          {
            name: 'status',
            label: 'Status',
            type: 'string',
            options: ['published', 'draft'],
          },
          { name: 'meta_title', label: 'Meta Title', type: 'string' },
          {
            name: 'meta_description',
            label: 'Meta Description',
            type: 'string',
          },
          { name: 'updated_at', label: 'Last Updated', type: 'datetime' },
          {
            name: 'body',
            label: 'Body',
            type: 'rich-text',
            isBody: true,
          },
        ],
      },
      {
        name: 'faqItem',
        label: 'FAQ Items',
        path: 'content/faq',
        format: 'json',
        fields: [
          {
            name: 'question',
            label: 'Question',
            type: 'string',
            required: true,
          },
          {
            name: 'answer',
            label: 'Answer',
            type: 'string',
            required: true,
            ui: { component: 'textarea' },
          },
          { name: 'sort', label: 'Sort Order', type: 'number' },
          { name: 'category', label: 'Category', type: 'string' },
        ],
      },
      {
        name: 'whatsappPreviewLink',
        label: 'WhatsApp Preview Links',
        path: 'content/whatsapp-preview-links',
        format: 'json',
        fields: [
          { name: 'key', label: 'Key', type: 'string', required: true },
          { name: 'og_title', label: 'OG Title', type: 'string', required: true },
          {
            name: 'og_description',
            label: 'OG Description',
            type: 'string',
            required: true,
          },
          { name: 'og_image', label: 'OG Image', type: 'image' },
          { name: 'url_path', label: 'URL Path', type: 'string', required: true },
          { name: 'is_active', label: 'Is Active?', type: 'boolean' },
        ],
      },
    ],
  },
});

export default config;
