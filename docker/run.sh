#!/usr/bin/env bash
# Koya API — Docker run helper
# Usage: ./docker/run.sh [--build]
set -euo pipefail

IMAGE_NAME="koya-api"
CONTAINER_NAME="koya-api"
ENV_FILE="$(dirname "$0")/api.env"
PORT=3333

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

# Optional: rebuild image
if [[ "${1:-}" == "--build" ]]; then
  echo "Building $IMAGE_NAME..."
  docker build -t "$IMAGE_NAME" -f apps/api/Dockerfile .
fi

# Stop existing container if running
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Stopping existing container..."
  docker stop "$CONTAINER_NAME" && docker rm "$CONTAINER_NAME"
fi

echo "Starting $CONTAINER_NAME on port $PORT..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "127.0.0.1:${PORT}:${PORT}" \
  --env-file "$ENV_FILE" \
  "$IMAGE_NAME" \
  sh -c "cd prisma && npx prisma migrate deploy && cd .. && node main.js"

echo "Container $CONTAINER_NAME started. Checking health..."
sleep 3
docker logs --tail 20 "$CONTAINER_NAME"
