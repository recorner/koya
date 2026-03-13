# ─── Stage 1: Install dependencies ──────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@10.32.0 --activate

WORKDIR /app

# Copy workspace config files needed for install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY libs/types/package.json libs/types/
COPY libs/config/package.json libs/config/
COPY libs/ui/package.json libs/ui/

RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.32.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN pnpm prisma generate --schema=apps/api/prisma/schema.prisma

# Build the API — webpack bundles everything + generates package.json & lockfile
RUN pnpm nx build api

# ─── Stage 3: Production ───────────────────────────────────────
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.32.0 --activate

# Security: run as non-root
RUN addgroup --system --gid 1001 koya && \
    adduser --system --uid 1001 koya

WORKDIR /app

# Copy built output (includes generated package.json + pruned lockfile)
COPY --from=builder /app/dist/apps/api ./

# Copy Prisma schema + migrations for runtime migration
COPY --from=builder /app/apps/api/prisma ./prisma

# Replace TypeScript config with plain JS (no TS runtime in production)
RUN rm -f prisma/prisma.config.ts && \
    printf 'const path = require("path");\nconst { defineConfig } = require("prisma/config");\nmodule.exports = defineConfig({\n  earlyAccess: true,\n  schema: path.join(__dirname, "schema.prisma"),\n  datasource: { url: process.env.DATABASE_URL }\n});\n' > prisma/prisma.config.js

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Add tslib (webpack externalizes it but generatePackageJson misses the importHelpers import)
RUN pnpm add tslib

# Generate Prisma client in production context
RUN pnpm prisma generate --schema=prisma/schema.prisma

# Switch to non-root user
USER koya

ENV NODE_ENV=production
ENV PORT=3333

EXPOSE 3333

# Run migrations then start
CMD ["sh", "-c", "cd prisma && npx prisma migrate deploy && cd .. && node main.js"]
