#!/usr/bin/env bash
# Koya Bria — Docker run helper
# Usage: ./docker/run-bria.sh [--build]
set -euo pipefail

IMAGE_NAME="koyabank/bria"
CONTAINER_NAME="koya-bria"
ENV_FILE="$(dirname "$0")/bria.env"
CONFIG_FILE="$(dirname "$0")/../config/bria.yml"
API_PORT=2742
ADMIN_PORT=2743

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found"
  echo "Copy docker/bria.env.example to docker/bria.env and fill in values."
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: $CONFIG_FILE not found"
  echo "Copy config/bria.yml.example to config/bria.yml and adjust settings."
  exit 1
fi

# Optional: rebuild image
if [[ "${1:-}" == "--build" ]]; then
  echo "Building $IMAGE_NAME..."
  docker build -t "$IMAGE_NAME" -f Dockerfile.bria .
fi

# Ensure bria-pg is running (standalone mode needs its own database)
if ! docker ps --format '{{.Names}}' | grep -q "^koya-bria-pg$"; then
  echo "Starting bria-pg database..."
  docker compose up -d bria-pg 2>/dev/null || echo "Warning: bria-pg not started via compose. Ensure PG_CON in bria.env points to a valid database."
  sleep 3
fi

# Stop existing container if running
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Stopping existing container..."
  docker stop "$CONTAINER_NAME" && docker rm "$CONTAINER_NAME"
fi

echo "Starting $CONTAINER_NAME (API: $API_PORT, Admin: $ADMIN_PORT)..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "127.0.0.1:${API_PORT}:${API_PORT}" \
  -p "127.0.0.1:${ADMIN_PORT}:${ADMIN_PORT}" \
  --env-file "$ENV_FILE" \
  -v "$(cd "$(dirname "$0")/.." && pwd)/config/bria.yml:/etc/bria/bria.yml:ro" \
  "$IMAGE_NAME"

echo "Container $CONTAINER_NAME started. Checking health..."
sleep 5
docker logs --tail 20 "$CONTAINER_NAME"
