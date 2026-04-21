# ── Secrets Manager Placeholders ──────────────────────────────────
# Creates empty secret containers for all Koya secrets.
# Values must be populated manually or via scripts/sync-secrets.sh.

locals {
  secrets = {
    # API core
    "/koya/api/DATABASE_URL"   = "PostgreSQL connection string"
    "/koya/api/REDIS_PASSWORD" = "Redis authentication password"
    "/koya/api/FX_API_KEY"     = "Foreign exchange rate API key"
    "/koya/api/SLACK_WEBHOOK"  = "Slack webhook URL for ops alerts"

    # M-Pesa / Daraja
    "/koya/daraja/consumerKey"    = "Safaricom Daraja consumer key"
    "/koya/daraja/consumerSecret" = "Safaricom Daraja consumer secret"
    "/koya/daraja/passkey"        = "Safaricom Daraja passkey"

    # DFNS
    "/koya/dfns/apiKey"        = "DFNS API key"
    "/koya/dfns/mTlsCert"      = "DFNS mTLS client certificate (PEM)"
    "/koya/dfns/mTlsKey"       = "DFNS mTLS client key (PEM)"
    "/koya/dfns/webhookSecret" = "DFNS webhook HMAC secret"

    # Bria
    "/koya/bria/signerEncryptionKey"      = "Bria signer encryption key"
    "/koya/bria/pgConnection"             = "Bria PostgreSQL connection string"
    "/koya/bria/apiKey"                   = "Bria API key"
    "/koya/bria/adminApiKey"              = "Bria admin API key"
    "/koya/bria/walletDescriptorExternal" = "Bria signing descriptor for external receive path"
    "/koya/bria/walletDescriptorInternal" = "Bria signing descriptor for internal change path"

    # WhatsApp Cloud API
    "/koya/whatsapp/appSecret"   = "Meta WhatsApp app secret for webhook signature verification"
    "/koya/whatsapp/verifyToken" = "Meta WhatsApp webhook verify token"
    "/koya/whatsapp/accessToken" = "Meta WhatsApp Cloud API access token"

    # Telegram Bot API
    "/koya/telegram/botToken"      = "Telegram bot API token"
    "/koya/telegram/webhookSecret" = "Telegram webhook secret token"

    # Web / Payload preview
    "/koya/payload/previewUserEmail"    = "Payload preview service account email for web draft mode fetches"
    "/koya/payload/previewUserPassword" = "Payload preview service account password for web draft mode fetches"
    "/koya/web/previewSecret"           = "Koya web preview endpoint secret"
    "/koya/web/revalidateWebhookSecret" = "HMAC secret for signed Payload publish revalidation webhooks"
  }
}

resource "aws_secretsmanager_secret" "koya" {
  for_each = local.secrets

  name        = each.key
  description = each.value

  recovery_window_in_days = var.environment == "production" ? 30 : 7

  tags = {
    Component = "secrets"
  }
}

# Seed with placeholder value so ECS can start
resource "aws_secretsmanager_secret_version" "koya_placeholder" {
  for_each = var.environment == "production" ? {} : local.secrets

  secret_id     = aws_secretsmanager_secret.koya[each.key].id
  secret_string = "PLACEHOLDER_REPLACE_ME"

  lifecycle {
    ignore_changes = [secret_string]
  }
}
