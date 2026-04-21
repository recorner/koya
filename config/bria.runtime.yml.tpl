db:
  pool_size: 20
  migrate_on_start: true

app:
  blockchain:
    network: ${BRIA_NETWORK}
    electrum_url: "${BRIA_ELECTRUM_URL}"
  jobs:
    sync_all_wallets_delay: 10
    process_all_payout_queues_delay: 10
    respawn_all_outbox_handlers_delay: 10
    signing:
      warn_retries: 2
      max_attempts: 5
      max_retry_delay: 3600
  fees:
    mempool_space: {}
  security:
    blocked_addresses: []

api:
  listen_port: ${BRIA_API_PORT}

admin:
  listen_port: ${BRIA_ADMIN_PORT}

tracing:
  host: "localhost"
  port: 4317
  service_name: "bria-koya"
