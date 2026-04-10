# Step 30 — TinaCMS Triple Fix: Auth, Routing, Docker

## Problems
1. **Auth redirect to tina.io** — No `authProvider` set in TinaCMS config, defaulting to `TinaCloudAuthProvider`
2. **tina.koyabank.com showing main site** — Nginx proxied root `/` to Next.js which served the homepage instead of admin UI
3. **No containerization** — TinaCMS admin running via bare systemd, no Docker image for ECS

## Solutions

### Auth Fix
- Added `import { defineConfig, LocalAuthProvider } from 'tinacms'` to `tina/config.ts`
- Added `authProvider: new LocalAuthProvider()` to `defineConfig()`
- Removed any `clientId`/`token` references
- Rebuilt with `tinacms build --local --skip-cloud-checks`

### Routing Fix
- Root cause: Next.js serves its full app (homepage) at `/`, admin is at `/admin/index.html`
- Next.js 308-redirects `/admin/` → `/admin` (trailing slash removal), and `/admin` returns 404
- Solution: Nginx `location = /` returns 301 to `/admin/index.html`; added `location = /admin` redirect too
- Verified full chain: `tina.koyabank.com/` → 301 → `/admin/index.html` → 200

### Docker Containerization
- Added `output: 'standalone'` to `next.config.js` (Vercel ignores this)
- Created `Dockerfile.tina` — 3-stage build (deps → builder → runner)
  - Stage 1: pnpm install with frozen lockfile
  - Stage 2: tinacms build + next build
  - Stage 3: Copy standalone output + static + public + tina/__generated__ + content
- Created `Dockerfile.tina.dockerignore` — overrides default `.dockerignore` that excludes `apps/web`
- Image size: 214MB, runs as non-root user
- Content directory mounted as volume for runtime edits
- Added `tina` service to `docker-compose.yml` on port 3001

## Files Changed
- `apps/web/tina/config.ts` — LocalAuthProvider
- `apps/web/next.config.js` — `output: 'standalone'`
- `Dockerfile.tina` — new
- `Dockerfile.tina.dockerignore` — new
- `docker-compose.yml` — added tina service
- `/etc/nginx/sites-available/tina.koyabank.com` — root + /admin redirects
- Deleted `apps/web/lib/directus/` — leftover causing build failure

## Verification
- `tina.koyabank.com/` → redirects to admin UI (200)
- GraphQL API returns real content data
- Docker container starts and serves admin UI on port 3001
- No references to tina.io or TinaCloudAuthProvider in config
