#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Koya SSL Setup — Let's Encrypt via Certbot (nginx certonly + manual config)
#
# Usage:
#   chmod +x nginx/ssl-setup.sh
#   sudo ./nginx/ssl-setup.sh
#
# Prerequisites:
#   - nginx installed and running
#   - DNS A records pointing to this server (port 80 open):
#       koyabank.com      → <server-ip>
#       www.koyabank.com  → <server-ip>   (optional — skipped if no DNS record)
#       api.koyabank.com  → <server-ip>
#   - If behind Cloudflare: set DNS to "DNS only" (grey cloud) for all three
#     records BEFORE running this script. Re-enable proxy after certs are issued.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ADMIN_EMAIL="westronet@icloud.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── 1. Install Certbot + nginx plugin if not present ─────────────────────────
if ! command -v certbot &>/dev/null; then
  echo "Installing certbot..."
  apt-get update -q
  apt-get install -y certbot python3-certbot-nginx
fi

# ── 2. Write rate-limit zone to conf.d (http context) ────────────────────────
cat > /etc/nginx/conf.d/koya-rate-limit.conf << 'EOF'
# Rate limiting zone for api.koyabank.com
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;
EOF
echo "Installed /etc/nginx/conf.d/koya-rate-limit.conf"

# ── 3. Remove default site if it conflicts ────────────────────────────────────
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  rm /etc/nginx/sites-enabled/default
  echo "Removed default nginx site"
fi

# ── 4. Deploy HTTP-only (bootstrap) configs so nginx can start ───────────────
# These only handle port 80 and serve ACME challenges. Full SSL added after certs.
cat > /etc/nginx/sites-available/koyabank.com << 'NGINXEOF'
server {
    listen      80;
    listen      [::]:80;
    server_name koyabank.com www.koyabank.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }

    location / {
        return 200 'Koya Bank — SSL bootstrap in progress';
        add_header Content-Type text/plain;
    }
}
NGINXEOF

cat > /etc/nginx/sites-available/api.koyabank.com << 'NGINXEOF'
server {
    listen      80;
    listen      [::]:80;
    server_name api.koyabank.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }

    location / {
        return 200 'Koya API — SSL bootstrap in progress';
        add_header Content-Type text/plain;
    }
}
NGINXEOF

for conf in koyabank.com api.koyabank.com; do
  if [[ ! -L /etc/nginx/sites-enabled/${conf} ]]; then
    ln -s /etc/nginx/sites-available/${conf} /etc/nginx/sites-enabled/${conf}
    echo "Enabled $conf"
  fi
done

mkdir -p /var/www/certbot
chown www-data:www-data /var/www/certbot

nginx -t && systemctl reload nginx
echo "Bootstrap nginx configs loaded"

# ── 5. Detect whether www.koyabank.com has a DNS record ──────────────────────
echo ""
if host www.koyabank.com &>/dev/null 2>&1; then
  WWW_DOMAINS="-d koyabank.com -d www.koyabank.com"
  echo "DNS: www.koyabank.com found — including in certificate"
else
  WWW_DOMAINS="-d koyabank.com"
  echo "DNS: No www.koyabank.com record — issuing cert for apex only"
fi

# ── 6. Issue certificates (certonly — we manage nginx configs manually) ───────
echo ""
echo "Requesting certificate for koyabank.com..."
certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$ADMIN_EMAIL" \
  --agree-tos \
  --no-eff-email \
  $WWW_DOMAINS

echo ""
echo "Requesting certificate for api.koyabank.com..."
certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$ADMIN_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d api.koyabank.com

# ── 7. Install full SSL configs now that certs exist ─────────────────────────
echo ""
echo "Installing full SSL nginx configs..."
cp "$SCRIPT_DIR/koyabank.com.conf"     /etc/nginx/sites-available/koyabank.com
cp "$SCRIPT_DIR/api.koyabank.com.conf" /etc/nginx/sites-available/api.koyabank.com

nginx -t && systemctl reload nginx
echo "Full HTTPS configs loaded"

# ── 8. Verify auto-renewal ───────────────────────────────────────────────────
echo ""
echo "Testing auto-renewal dry-run..."
certbot renew --dry-run

# ── 9. Install renewal cron (if not present) ─────────────────────────────────
CRON_JOB="0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'"
EXISTING_CRON=$(crontab -l 2>/dev/null || true)
if ! echo "$EXISTING_CRON" | grep -qF "certbot renew"; then
  (echo "$EXISTING_CRON"; echo "$CRON_JOB") | crontab -
  echo "Auto-renewal cron installed (runs daily at 03:00)."
else
  echo "Auto-renewal cron already present."
fi

echo ""
echo "──────────────────────────────────────────────────────────────"
echo " SSL setup complete."
echo " Certificates:  /etc/letsencrypt/live/koyabank.com/"
echo "                /etc/letsencrypt/live/api.koyabank.com/"
echo " Admin email:   $ADMIN_EMAIL"
echo " Renewal:       automatic (cron, daily 03:00)"
echo ""
echo " CLOUDFLARE: You can now re-enable the orange cloud proxy"
echo " for koyabank.com (and www) in Cloudflare DNS."
echo " Keep api.koyabank.com on DNS-only (grey cloud) unless you"
echo " configure Cloudflare Full (Strict) SSL mode for the API."
echo "──────────────────────────────────────────────────────────────"
