# Step 01 — Monorepo Scaffold

**Status:** Complete  
**Date:** 2025-07-21

## What was built

- Nx 22.5 monorepo with pnpm workspaces
- Next.js 16 web app with App Router and route groups
- NestJS 11 API with health endpoint
- 3 shared libraries: `types`, `config`, `ui`
- Tailwind CSS v4 design system with Koya brand tokens
- 6 shadcn/ui components (Button, Card, Input, Dialog, Sheet, Tabs)
- Brand assets: SVG logo mark, icon, and web manifest
- Landing shell with animated logo, glass card, and gold CTA

## Key Decisions

| Decision | Reasoning |
|----------|-----------|
| Tailwind v4 CSS-first config | Next.js 16 ships with Tailwind v4; uses `@theme` blocks in CSS instead of `tailwind.config.ts` |
| Syne / DM Sans / JetBrains Mono fonts | Per Design.md — explicitly NOT Inter or Space Grotesk |
| SVG favicon (not PNG/ICO) | Avoids sharp native build dependency; SVG favicons have universal modern browser support |
| Manual shadcn/ui components | `shadcn init` fails in Nx monorepo; hand-wrote 6 components with Koya dark theme baked in |
| Route groups `(public)`, `(auth)`, `(dashboard)` | Clean separation for layout strategies without URL nesting |
| Shared libs via Nx generators | `@koya/types`, `@koya/config`, `@koya/ui` — path aliases in tsconfig.base.json |

## What's NOT included (deferred)

- Database (Prisma/Drizzle) — Step 2
- Authentication (NextAuth/Clerk) — Step 3
- Payment/crypto integrations — Step 4+
- Testing setup (Vitest/Jest) — Step 2
- CI/CD pipeline — Step 3
- Docker — Step 4

## Step 2 Recommendations

1. Set up Prisma with PostgreSQL (Neon or Supabase)
2. Add Vitest for unit testing
3. Create user and account domain models
4. Build the auth flow (signup → email verify → KYC tier selection)
5. Implement the dashboard layout with sidebar navigation
