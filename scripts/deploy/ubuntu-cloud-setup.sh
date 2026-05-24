#!/usr/bin/env bash
set -euo pipefail

DOMAIN="route-api-syrus.ia.br"
EMAIL=""
APP_DIR="/opt/omniroute"
APP_USER=""
REPO_URL="https://github.com/pablolira-1982/OmniRoute.git"
BRANCH="main"
APP_PORT="20128"
SKIP_CERTBOT="0"

log() { echo "[omniroute-setup] $*"; }
err() { echo "[omniroute-setup][ERROR] $*" >&2; }

usage() {
  cat <<EOF
Usage:
  sudo bash scripts/deploy/ubuntu-cloud-setup.sh \\
    --domain <domain> \\
    --email <email> \\
    [--app-dir /opt/omniroute] \\
    [--app-user ubuntu] \\
    [--repo https://github.com/pablolira-1982/OmniRoute.git] \\
    [--branch main] \\
    [--port 20128] \\
    [--skip-certbot]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --app-dir) APP_DIR="$2"; shift 2 ;;
    --app-user) APP_USER="$2"; shift 2 ;;
    --repo) REPO_URL="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --port) APP_PORT="$2"; shift 2 ;;
    --skip-certbot) SKIP_CERTBOT="1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown argument: $1"; usage; exit 1 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  err "Run as root (sudo)."
  exit 1
fi

if [[ -z "$EMAIL" ]]; then
  err "--email is required."
  usage
  exit 1
fi

if [[ -z "$APP_USER" ]]; then
  APP_USER="${SUDO_USER:-ubuntu}"
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
  err "App user '$APP_USER' does not exist."
  exit 1
fi

log "Updating apt cache and base packages..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl gnupg lsb-release software-properties-common \
  git jq unzip build-essential pkg-config python3 make g++ \
  nginx certbot python3-certbot-nginx

install_node() {
  local current_major=""
  if command -v node >/dev/null 2>&1; then
    current_major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
  fi

  if [[ "$current_major" == "22" ]]; then
    log "Node.js 22 already installed: $(node -v)"
    return
  fi

  log "Installing Node.js 22.x via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  log "Node installed: $(node -v)"
  log "npm installed: $(npm -v)"
}

install_node

log "Preparing app directory: $APP_DIR"
mkdir -p "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
  log "Repository exists. Updating..."
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --all --prune
  sudo -u "$APP_USER" git -C "$APP_DIR" checkout "$BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  log "Cloning repository..."
  sudo -u "$APP_USER" git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

log "Installing dependencies (npm ci)..."
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm ci"

if [[ ! -f "$APP_DIR/.env" ]]; then
  log "Creating .env from .env.example"
  sudo -u "$APP_USER" cp "$APP_DIR/.env.example" "$APP_DIR/.env"
fi

log "Building application..."
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm run build"

log "Creating systemd service..."
cat >/etc/systemd/system/omniroute.service <<EOF
[Unit]
Description=OmniRoute Service
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
TimeoutStopSec=40

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable omniroute
systemctl restart omniroute

log "Configuring Nginx site (onimiroute.conf)..."
cat >/etc/nginx/sites-available/onimiroute.conf <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN route-api-syrus.ia.br;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }
}
EOF

ln -sf /etc/nginx/sites-available/onimiroute.conf /etc/nginx/sites-enabled/onimiroute.conf
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl reload nginx

if [[ "$SKIP_CERTBOT" == "0" ]]; then
  log "Requesting TLS certificate with Certbot..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
  systemctl reload nginx
else
  log "Skipping Certbot (--skip-certbot enabled)."
fi

log "Done."
log "Next steps:"
log "1) Edit $APP_DIR/.env and set secrets + Supabase vars"
log "2) Restart service: systemctl restart omniroute"
log "3) Check logs: journalctl -u omniroute -f"
