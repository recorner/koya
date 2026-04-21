#!/usr/bin/env sh
set -eu

: "${BRIA_NETWORK:=testnet4}"
: "${BRIA_ELECTRUM_URL:=mempool.space:40002}"
: "${BRIA_API_PORT:=2742}"
: "${BRIA_ADMIN_PORT:=2743}"
: "${BRIA_CONFIG_TEMPLATE:=/etc/bria/bria.yml.tpl}"
: "${BRIA_CONFIG:=/tmp/bria.yml}"

# Allow one-off CLI tasks to run custom commands (wallet/bootstrap/probe ops),
# while still templating config for the normal daemon startup command.
if [ "$#" -gt 0 ]; then
  if [ "${1}" != "bria" ] || [ "${2:-}" != "daemon" ] || [ "${3:-}" != "run" ]; then
    exec "$@"
  fi
fi

if [ ! -f "${BRIA_CONFIG_TEMPLATE}" ]; then
  echo "Bria config template not found: ${BRIA_CONFIG_TEMPLATE}" >&2
  exit 1
fi

envsubst '${BRIA_NETWORK} ${BRIA_ELECTRUM_URL} ${BRIA_API_PORT} ${BRIA_ADMIN_PORT}' \
  < "${BRIA_CONFIG_TEMPLATE}" \
  > "${BRIA_CONFIG}"

exec bria daemon run
