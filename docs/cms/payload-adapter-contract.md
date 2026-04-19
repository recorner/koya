# Koya CMS Adapter Contract (Phase 3)

## Function to Payload Mapping

| Koya CMS function | Payload source |
|---|---|
| `getPageBySlug(path)` | `GET /api/pages?where[path][equals]=<path>&limit=1` |
| `getGlobalSettings()` | `GET /api/globals/site-settings` |
| `getBranding()` | `GET /api/globals/site-settings` + `GET /api/globals/theme-settings` |
| `getSeoDefaults()` | `GET /api/globals/seo-defaults` |
| `getNavigation()` | `GET /api/globals/navigation` |
| `getFooterColumns()` | `GET /api/globals/footer` |
| `getFaqItems()` | `GET /api/faqs` |
| `getLegalPage(slug)` | `GET /api/legal-pages?where[slug][equals]=<slug>&limit=1` |
| `getLegalPages()` | `GET /api/legal-pages` |
| `getWhatsAppPreviewLink(key)` | `GET /api/whatsapp-preview-links?where[key][equals]=<key>&limit=1` |

## Revalidation Tags and Paths

Payload publish webhooks are consumed by `POST /api/revalidate` (signed `x-koya-*` contract).

- Primary strategy: use payload-provided `tags` and `paths` directly.
- Fallback strategy (when webhook omits tags/paths):
  - `pages` -> tags: `pages`, `page:<path>`; path: `<path>`
  - `legal-pages` -> tags: `legal-pages`, `legal:<slug>`; path: `<path>`
  - `faqs` -> tag: `faqs`; path: `/`
  - `whatsapp-preview-links` -> tag: `whatsapp-preview-links`; path: `/`
  - `site-settings` -> tags: `site-settings`, `navigation`, `footer`; path: `/`
  - `seo-defaults` -> tag: `seo-defaults`; path: `/`
  - `theme-settings` -> tag: `theme-settings`; path: `/`
  - `navigation` -> tag: `navigation`; path: `/`
  - `footer` -> tag: `footer`; path: `/`

## Compatibility Shims

- Koya keeps existing `apps/web/lib/cms` exports and Koya-owned type names.
- Payload block types are normalized to Koya section types (camelCase -> snake_case).
- Lexical rich text from Payload is normalized to HTML string for existing legal/rich-text rendering surfaces.
- Convert page trust-footer copy currently uses normalized `trust_footer_items` section items.

## Known Gaps for Phase 4

- Add dedicated automated tests for normalizers and webhook signature verification utilities.
- Consider richer Lexical renderer coverage (more node types/formatting fidelity).
- Consider dedicated theming runtime with broader token-to-variable mapping if more brand controls are needed.
- Remove or archive legacy file content fixtures if no longer needed for local-only fallback workflows.
