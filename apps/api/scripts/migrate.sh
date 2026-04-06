#!/bin/sh
set -e

# Prisma migration deploy script
# Run as a separate ECS task or deploy step BEFORE rolling out new API containers.
#
# Usage:
#   docker run --rm --env DATABASE_URL=... koya/api:latest sh /app/scripts/migrate.sh
#   Or: ECS RunTask with command override: ["sh", "/app/scripts/migrate.sh"]

echo "=== Koya API: Running Prisma migrations ==="

cd /app/prisma
npx prisma migrate deploy

echo "=== Migrations complete ==="
