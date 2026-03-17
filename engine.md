You are integrating Directus as the CMS for the Koya Bank marketing website.

Context:
- Koya is a premium fintech / borderless banking platform.
- Current frontend stack is Next.js App Router with custom premium components.
- The CMS must power only the public marketing site for now, not the banking core, dashboard, auth, ledger, wallets, KYC, or conversion engine.
- We currently only have the landing page and some components.
- We want to connect Directus early so all public marketing content is published from the CMS.
- We will also create additional footer and marketing pages soon.

Goal:
Implement the first production-safe Directus integration for the public site only.

Scope:
1. Add Directus integration to the Next.js app.
2. Create a clean CMS content model for:
   - global settings
   - navigation
   - footer
   - pages
   - page sections
   - FAQ items
   - legal pages / static content pages
   - SEO defaults
3. Refactor the current landing page so its content is fetched from Directus while preserving the current visual design and component structure.
4. Build reusable page rendering so future marketing pages can be created in Directus and rendered by slug.
5. Keep all rendering logic in code and all content in Directus.
6. Do not connect Directus to any core banking domain tables or backend business logic.

Requirements:
- Use Next.js App Router patterns.
- Create a `lib/directus` client setup.
- Use server-side fetching for public content.
- Support draft/published status cleanly if possible.
- Build a page renderer that maps section types to React components.
- Keep the design premium and aligned with Koya’s brand system.
- Do not introduce generic CMS-looking layouts.
- Preserve custom animations and styling in code.
- Add clear TypeScript types for CMS responses.
- Add a fallback strategy for missing content.
- Add comments where needed to explain the architecture.

Suggested Directus collections:
- global_settings
- navigation
- footer
- pages
- page_sections
- faq_items
- legal_pages
- seo_defaults

Suggested page section types:
- hero
- feature_grid
- stats
- logo_cloud
- faq
- cta
- rich_text
- final_cta

Deliverables:
- Directus client setup
- content fetch utilities
- typed CMS interfaces
- homepage refactor to CMS-driven content
- dynamic public page route by slug
- section renderer mapping
- example seed content shape / expected CMS schema
- brief README notes for how to add new CMS-driven marketing pages

Important:
- Do not touch the app/dashboard product flows.
- Do not move business logic into Directus.
- Do not degrade the current premium UI into a generic template system.
- Think like a senior staff engineer building a scalable marketing platform for a fintech brand.