# Step 06 — Directus CMS Integration

**Status:** Complete  
**Date:** 2026-03-17

---

## Scope

Integrate Directus as the headless CMS for the Koya public marketing site. All marketing page content becomes editable from the CMS while preserving the premium glassmorphism UI and existing component architecture.

**Goal:** Content editors can create, reorder, and publish marketing pages from Directus without any code changes.

---

## What Was Built

### Directus Instance
- Docker container: `directus-koyabank-cms` (custom build `directus-olesereni:local`)
- Database: SQLite (embedded, portable)
- Public URL: `https://cms.koyabank.com`
- Admin panel: `http://localhost:8055` (proxied via nginx in production)

### CMS Collections (8 custom collections)

| Collection | Type | Purpose |
|------------|------|---------|
| `global_settings` | Singleton | Site name, tagline, description, social URLs, contact email |
| `seo_defaults` | Singleton | Fallback SEO title/description, OG image, title suffix |
| `navigation` | Collection | Header nav links (label, href, sort, is_cta) |
| `footer_columns` | Collection | Footer column groups (title, sort) |
| `footer_links` | Collection | Footer links within columns (O2M relation to footer_columns) |
| `pages` | Collection | Marketing pages (title, slug, status, meta fields) |
| `page_sections` | Collection | Content sections within pages (O2M relation to pages) |
| `faq_items` | Collection | FAQ entries with category support |
| `legal_pages` | Collection | Legal/static content pages (Terms, Privacy, AML, etc.) |

### Section Types (13 registered)

| Type | Maps To | CMS-Editable Content |
|------|---------|---------------------|
| `market_ribbon` | MarketRibbon | Ordering only |
| `hero` | HeroSection | Ordering only |
| `swap_widget` | CmsSwapSection | Heading, subheading, badge text |
| `stats` | TrustStrip | Ordering only |
| `feature_grid` | ProductPillars | Ordering only |
| `how_it_works` | HowItWorks | Ordering only |
| `security` | SecuritySection | Ordering only |
| `cards` | CardsSection | Ordering only |
| `global_finance` | GlobalFinanceSection | Ordering only |
| `final_cta` | FinalCTA | Ordering only |
| `rich_text` | CmsRichText | Full content (heading, body, badge) |
| `cta` | CmsCta | Heading, subheading, CTA buttons |
| `faq` | (future) | FAQ list rendering |

### Next.js Integration

#### Directus Client (`apps/web/lib/directus/`)
- `client.ts` — Directus SDK setup with static token auth (server-side only)
- `types.ts` — Full TypeScript interfaces for all CMS collections
- `queries.ts` — Query functions with graceful error fallbacks
- `section-renderer.tsx` — Maps `section_type` → React component
- `index.ts` — Barrel export

#### CMS Wrapper Components (`apps/web/components/marketing/cms/`)
- `cms-swap-section.tsx` — Swap widget with CMS heading/subheading
- `cms-rich-text.tsx` — Arbitrary rich text content section
- `cms-cta.tsx` — Call-to-action block with CMS buttons

#### Routes
- `/` (homepage) — Now CMS-driven with hardcoded fallback if Directus is unavailable
- `/[...slug]` — Dynamic catch-all for future CMS marketing pages
- `/legal/[slug]` — Legal pages from `legal_pages` collection

### Config Changes
- `.env` — Added `NEXT_PUBLIC_DIRECTUS_URL`, `DIRECTUS_URL`, `DIRECTUS_TOKEN`
- `next.config.js` — Added `images.remotePatterns` for `cms.koyabank.com` assets
- `package.json` — Added `@directus/sdk ^21.2.0`

### Schema Setup Script
- `scripts/directus-setup.py` — Creates all collections, fields, relations, and seeds homepage data
- Idempotent for fields/collections (errors on re-run are safe)
- Sets public read permissions for unauthenticated API access

---

## Architecture Decisions

1. **Existing components unchanged:** All 10 marketing components remain zero-prop, hardcoded. CMS controls section ordering only. This preserves the premium UI completely — no risk of CMS content breaking the design.

2. **Graceful fallback:** If Directus is unavailable, the homepage renders the hardcoded layout. No user-facing errors from CMS downtime.

3. **ISR with 60s revalidation:** `revalidate = 60` on CMS-driven pages. Content updates propagate within 1 minute without rebuilds.

4. **Static token auth:** Server-side fetching uses a static Directus token (no JWT refresh needed). Token stored in environment variables, never exposed to the client.

5. **SDK type casting:** Directus SDK's schema generics cause issues with singleton collections. We use an untyped client with explicit `as never` casts in query functions and type the return values manually. Pragmatic trade-off — full type safety in the query layer, loose typing at the SDK boundary.

6. **Content in CMS, rendering in code:** Section types like `rich_text` and `cta` accept full CMS content. Complex sections (hero, security, cards) keep their hardcoded premium layouts — CMS only controls whether they appear and in what order.

---

## Seed Data

The homepage (`slug: /`) is seeded with 10 sections matching the original hardcoded layout:
1. Market Ribbon → 2. Hero → 3. Swap Widget → 4. Trust Strip → 5. Product Pillars → 6. How It Works → 7. Security → 8. Cards → 9. Global Finance → 10. Final CTA

Navigation, footer columns/links, global settings, and SEO defaults are also seeded with production-ready content.

---

## Verification

- ✅ `npx nx build web` — TypeScript compilation + production build passes
- ✅ All 7 routes prerendered successfully (including new `/[...slug]` and `/legal/[slug]`)
- ✅ Directus API responds with seeded data (pages, sections, navigation, footer, settings)
- ✅ Static token authentication works for relational queries
- ✅ Public read permissions set on all CMS collections

---

## How to Add a New CMS-Driven Marketing Page

1. In Directus admin, create a new **Page** with a slug (e.g. `/about`)
2. Add **Page Sections** to that page, choosing section types and setting sort order
3. Set status to **Published**
4. The page is live at `koyabank.com/about` within 60 seconds (ISR)

To add a new section type:
1. Create the React component in `components/marketing/`
2. Register it in `lib/directus/section-renderer.tsx`
3. Add the type value to the `page_sections.section_type` dropdown in Directus

---

## Dependencies Added

```
@directus/sdk    # Directus REST client SDK
```
