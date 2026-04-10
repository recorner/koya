Use this as the developer prompt:

# Developer Prompt — Replace Directus CMS with TinaCMS in Koya

## Objective
Completely remove Directus from Koya and replace it with **TinaCMS**.

Target outcome:
- TinaCMS becomes the only CMS for Koya’s public/marketing/editorial content
- the editor is accessible at **`tina.koyabank.com`**
- the CMS remains inside the **existing monorepo / Next.js web app**
- no second content repo is introduced
- Directus dependencies, env vars, queries, asset URL assumptions, and docs are removed
- Koya continues to deploy web on Vercel and API on ECS without mixing CMS into the API container

---

## Read first
Study these current files before changing anything:

- `apps/web/lib/directus/client.ts` — current Directus client, env vars, and asset URL behavior :contentReference[oaicite:6]{index=6}
- `apps/web/lib/directus/queries.ts` — current query surface and content models :contentReference[oaicite:7]{index=7}
- `apps/web/lib/directus/types.ts` — current CMS schemas and page-section model :contentReference[oaicite:8]{index=8}
- `apps/web/next.config.js` — current image remote pattern and cache policy :contentReference[oaicite:9]{index=9}
- `.env.example` — current Directus env vars still present :contentReference[oaicite:10]{index=10}
- `README.md` — current platform delivery model and architecture expectations :contentReference[oaicite:11]{index=11}
- `vercel.json` — standard Next.js Vercel delivery pattern :contentReference[oaicite:12]{index=12}
- `docs/progress/step-22.md` — Euclide delivery pattern and current Vercel philosophy :contentReference[oaicite:13]{index=13}

---

## Important architecture decision
Adopt this migration strategy:

### Do this
- integrate TinaCMS into the **existing `apps/web` Next.js app**
- keep content **inside the repo**
- expose the editor via **`tina.koyabank.com`**
- use a **separate Vercel project/domain** for editor access if needed
- preserve the current standard Next.js-on-Vercel model

### Do not do this
- do not put Tina in the API Dockerfile
- do not create a second standalone backend service for CMS
- do not keep Directus as a transitional dependency longer than necessary
- do not create a separate cloned content repo unless absolutely required

### Reason
Koya already ships the web as a standard Next.js app on Vercel, and Directus is only used for public/marketing/editorial content, not core transactional backend flows :contentReference[oaicite:14]{index=14} :contentReference[oaicite:15]{index=15} :contentReference[oaicite:16]{index=16}

---

## Migration scope

## 1. Remove Directus completely
Remove:
- `@directus/sdk` dependency
- `apps/web/lib/directus/*`
- Directus-specific env vars and docs
- `cms.koyabank.com/assets/**` assumptions in `next.config.js`
- any README/runbook references that say Directus is the CMS

Update:
- `.env.example`
- README
- docs/runbooks/environment-matrix.md if needed
- any deployment docs that mention Directus

---

## 2. Introduce TinaCMS inside the existing web app
Use TinaCMS in the current Next.js app.

### Expected output
Create the Tina setup in or alongside `apps/web`, following Tina’s generated structure and current best practices.

Preferred content structure:
```text
content/
  settings/
    global.json
    seo.json
    navigation.json
    footer.json
  pages/
    home.mdx
    about.mdx
    security.mdx
    ...
  legal/
    privacy-policy.mdx
    terms-of-service.mdx
  faq/
    general.json
    payments.json
  whatsapp-preview-links/
    *.json
public/
  uploads/

If Tina’s current generator prefers a different structure, follow the generator, but keep the content logically equivalent.

3. Map current Directus models to Tina collections

Recreate the current CMS surface in Tina.

Current Directus models to preserve

From the repo, the current content surface includes:

global_settings
seo_defaults
navigation
footer_columns
faq_items
pages
page_sections
legal_pages
whatsapp_preview_links
Required Tina model mapping

Implement equivalent Tina collections / documents for:

Singleton-ish documents
global settings
SEO defaults
navigation
footer
Collections
pages
legal pages
FAQ items or FAQ groups
WhatsApp preview links
Page builder sections

The current page section model includes section types like:

hero
feature_grid
stats
how_it_works
security
cards
global_finance
faq
cta
rich_text
final_cta
swap_widget
market_ribbon

Recreate these in Tina as a structured block/template system, not ad hoc JSON blobs.

4. Keep the current query API stable where possible

To reduce churn in the rest of the app, keep or closely mirror the current query function API.

Replace Directus-backed functions with Tina-backed equivalents, preserving these exported interfaces if practical:

getGlobalSettings()
getSeoDefaults()
getNavigation()
getFooterColumns() or equivalent footer getter
getFaqItems()
getPageBySlug()
getLegalPage()
getLegalPages()
getWhatsAppPreviewLink()

Goal:

migrate implementation without rewriting the entire web app at once

Create a new CMS layer such as:

apps/web/lib/cms/

and move the site to import from that instead of lib/directus.

5. Replace asset handling

Current asset handling builds URLs like:

${DIRECTUS_URL}/assets/${fileId}

That must go away.

New asset strategy

For the first Tina migration:

use public/uploads/ for media
store image paths directly in content
update image helpers so they return direct public paths
remove NEXT_PUBLIC_DIRECTUS_URL
remove DIRECTUS_URL
remove DIRECTUS_TOKEN

Also update apps/web/next.config.js:

remove the cms.koyabank.com remote image pattern
allow only what Tina/media now requires
keep the existing cache strategy intact

If later needed, note a follow-up for S3-backed Tina media, but do not block this migration on that.

6. Tina editor access at tina.koyabank.com

Make Tina accessible on:

tina.koyabank.com
Preferred deployment pattern

Use a second Vercel project that points to the same monorepo/web app, with Tina/editor routes enabled and protected.

This is preferable to putting Tina into the API Docker container.

Required work
document Vercel setup for the Tina/editor project
ensure editor env vars are isolated from the public site if needed
protect the editor surface appropriately
keep koyabank.com as the public site
keep tina.koyabank.com as the editorial interface

If Tina requires a route like /admin, support that inside the app, but wire the dedicated subdomain to the editor experience.

7. Commands to initialize and migrate

Use the Tina CLI rather than hand-rolling the initial scaffold.

Start with these commands

From repo root:

pnpm remove @directus/sdk

Then initialize Tina in the web app.

Use the current Tina CLI init flow. Start with:

cd apps/web
pnpm dlx @tinacms/cli@latest init

If the latest Tina CLI expects repo-root execution or a different command shape, follow the current generator prompts and keep the generated Tina config tied to apps/web.

After generation:

move/generated content/config into the final repo structure you choose
do not leave the migration half-generated
Then:
generate Tina client/types if required by the installed version
wire the CMS queries into apps/web/lib/cms
remove old Directus imports
8. Environment variable changes

Remove Directus envs from .env.example:

DIRECTUS_URL
DIRECTUS_TOKEN
NEXT_PUBLIC_DIRECTUS_URL if present elsewhere

Add Tina envs according to the generated/current Tina setup.

Use Tina’s generated/current env naming if it differs, but expect at least something like:

Tina client identifier
Tina token
Tina branch
optional editor host/domain configuration

Do not invent extra env vars unless needed.

Document all new env vars in:

.env.example
docs/runbooks/environment-matrix.md
any Vercel project setup docs
9. Docker / containerization rule
Primary rule

Do not modify the API Dockerfile to host Tina.

Koya’s API Docker image is for the NestJS backend and ECS runtime, not the CMS editor.

Optional local/self-hosted support

If container support is needed for local dev or preview only, add a separate web/Tina Dockerfile, for example:

apps/web/Dockerfile
or
Dockerfile.web

This is optional and must not become the primary production deployment path.

Production editor hosting should remain:

Vercel web app
tina.koyabank.com
10. Content migration strategy

Because current Directus content is externalized, implement one of these:

Preferred

If a Directus export exists:

write a one-time transform script to convert exported JSON/content into Tina-compatible documents
Fallback

If no Directus export is available:

recreate the current essential content manually in Tina seed files
preserve the current public site structure and slugs

At minimum, ensure the following pages/data exist after migration:

home page
navigation
footer
FAQ
legal pages
SEO defaults
WhatsApp preview links used by the current site
11. Docs to update

Update:

README.md
.env.example
docs/runbooks/environment-matrix.md
docs/progress/step-23.md (new)
any web/deploy docs that mention Directus

Document:

why Directus was removed
why Tina was chosen
how content is now stored
how tina.koyabank.com is deployed
how editors authenticate
how to add/edit content
how to add media
what commands are used locally
12. Acceptance criteria

This migration is complete when:

Directus is fully removed from Koya
@directus/sdk is removed
no app code depends on apps/web/lib/directus/*
TinaCMS is integrated into the current web app
current content models are recreated in Tina collections/documents
the public site still renders correctly
the editor is reachable through tina.koyabank.com
docs and env files are updated
API Dockerfile remains focused on the backend
a developer can set up Tina locally with documented commands
content/media no longer depend on cms.koyabank.com/assets/*
13. Final output required from the agent

At the end, provide:

migration summary
files changed
commands used
Tina env vars required
Vercel setup required for tina.koyabank.com
any content migration gaps or manual follow-up

### My practical note
For Koya, I strongly recommend:
- **same repo**
- **same Next app**
- **separate Vercel project/domain for editor**
- **no API Docker involvement**
