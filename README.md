# Koya — Borderless Finance

A hybrid financial infrastructure platform combining mobile money rails, stablecoin liquidity, traditional banking, and crypto custody into a single borderless financial operating system.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Nx 22.5 + pnpm |
| Web | Next.js 16 (App Router) |
| API | NestJS 11 |
| Language | TypeScript 5.9 (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Fonts | Syne · DM Sans · JetBrains Mono |

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start web app (port 3000)
pnpm dev:web

# Start API server (port 3333)
pnpm dev:api

# Start both
pnpm dev
```

## Workspace Structure

```
koya/
├── apps/
│   ├── web/           # Next.js 16 frontend
│   │   ├── app/
│   │   │   ├── (public)/    # Landing, marketing
│   │   │   ├── (auth)/      # Login, signup, KYC
│   │   │   └── (dashboard)/ # Authenticated app
│   │   ├── components/ui/   # shadcn/ui components
│   │   └── public/          # Static assets, logos
│   └── api/           # NestJS backend
│       └── src/
├── libs/
│   ├── types/         # Shared TypeScript types
│   ├── config/        # App constants & config
│   └── ui/            # Design token exports
├── docs/
│   └── progress/      # Step-by-step build log
└── nx.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:web` | Start Next.js dev server |
| `pnpm dev:api` | Start NestJS dev server |
| `pnpm dev` | Start both servers |
| `pnpm build` | Build all projects |
| `pnpm lint` | Lint all projects |
| `pnpm typecheck` | TypeScript type check |
| `pnpm format` | Format with Prettier |

## Design System

- **Vault Black** `#070708` — primary background
- **Gold** `#D4AF37` — primary accent, CTAs
- **Electric Cyan** `#00E5FF` — signal/notification color
- **Emerald** `#10B981` — success states
- **Glass morphism** — frosted glass cards with backdrop blur

## API

Health check: `GET http://localhost:3333/api/v1/health`

## Deployment

Vercel-ready. `vercel.json` points to the Next.js web app.

## License

Private — All rights reserved.
