# Step 29 — Replace Directus CMS with TinaCMS

**Date:** 2026-04-09  
**Release:** Euclide v1.1.001

---

## What Changed

Directus CMS was completely removed from Koya and replaced with **TinaCMS**, an open-source Git-backed CMS that stores content directly in the monorepo.

### Why

- Directus required a separate hosted service (`cms.koyabank.com`) — unnecessary operational overhead for marketing/editorial content
- TinaCMS keeps content in-repo (versioned, reviewable, no external dependency)
- The public site no longer has a runtime CMS dependency — content is read from local files at build/ISR time
- Editorial access via `tina.koyabank.com` (separate Vercel project, same repo)

### Architecture Decision

- TinaCMS is integrated into the **existing `apps/web` Next.js app**
- Content lives in `apps/web/content/` as JSON and MDX files
- No second content repo, no API Dockerfile changes
- Editor accessible at `tina.koyabank.com` via a separate Vercel project/domain

---

## Files Changed

### Removed
- `apps/web/lib/directus/` — entire directory (client.ts, queries.ts, types.ts, section-renderer.tsx, index.ts)
- `@directus/sdk` dependency from `package.json`
- Directus env vars (`DIRECTUS_URL`, `DIRECTUS_TOKEN`, `NEXT_PUBLIC_DIRECTUS_URL`)
- `cms.koyabank.com/assets/**` remote pattern from `next.config.js`

### Added
- `apps/web/tina/config.ts` — TinaCMS configuration with all collections
- `apps/web/lib/cms/` — new CMS query layer (types.ts, queries.ts, section-renderer.tsx, index.ts)
- `apps/web/content/` — seed content files
- `tinacms` and `@tinacms/cli` packages

### Modified
- All web page files — imports changed from `@/lib/directus` → `@/lib/cms`
- `apps/web/next.config.js` — removed Directus remote pattern
- API services — removed Directus SDK dependency
- `.env.example`, `docs/runbooks/environment-matrix.md` — updated env vars

---

## Tina Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_TINA_CLIENT_ID` | Tina Cloud client ID (empty for local) |
| `TINA_TOKEN` | Tina Cloud auth token (empty for local) |
| `TINA_BRANCH` | Git branch for content (default: `main`) |

---

## Vercel Setup for tina.koyabank.com

1. Create a second Vercel project pointing to the same monorepo
2. Set env vars: `NEXT_PUBLIC_TINA_CLIENT_ID`, `TINA_TOKEN`, `TINA_BRANCH`
3. Configure custom domain `tina.koyabank.com`
4. Editor accessible at `/admin`

---

## Follow-up Items

- [ ] Connect Tina Cloud for hosted editor authentication
- [ ] Migrate remaining Directus content not in seed files
- [ ] Consider S3-backed Tina media for production
- [ ] Set up `tina.koyabank.com` Vercel project
