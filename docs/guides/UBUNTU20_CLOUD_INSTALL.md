# OmniRoute SaaS Deployment Guide (Ubuntu Server 20.04)

This guide deploys OmniRoute on a cloud VM with:

- Ubuntu Server 20.04
- Node.js 22.x
- Nginx reverse proxy
- HTTPS via Certbot (Let's Encrypt)
- systemd service for automatic startup
- Supabase SaaS environment variables

## 1. Prerequisites

- A VM running Ubuntu 20.04 with sudo access
- Domain pointing to the VM public IP (A/AAAA record)
- Open ports in cloud firewall/security group: `22`, `80`, `443`
- Supabase project configured

## 2. One-command installer

From your VM shell:

```bash
sudo bash scripts/deploy/ubuntu-cloud-setup.sh \
  --domain route-api.syrus.ia.br \
  --email admin@syrus.ia.br \
  --app-dir /opt/omniroute \
  --repo https://github.com/pablolira-1982/OmniRoute.git \
  --branch main \
  --port 20128
```

Optional flags:

- `--skip-certbot` to configure Nginx without issuing TLS cert yet
- `--app-user <user>` to run app under a specific Linux user

## 3. Configure `.env`

After the script finishes, edit:

```bash
sudo -u <app-user> nano /opt/omniroute/.env
```

Minimum required keys:

```env
JWT_SECRET=<openssl rand -base64 48>
API_KEY_SECRET=<openssl rand -hex 32>
INITIAL_PASSWORD=<strong-password>

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
SAAS_TOKEN_HASH_PEPPER=<openssl rand -hex 32>

PORT=20128
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://route-api.syrus.ia.br
```

Public API endpoint:

```text
https://route-api.syrus.ia.br/v1
```

## 4. Restart and validate

```bash
sudo systemctl restart omniroute
sudo systemctl status omniroute --no-pager
curl -I https://route-api.syrus.ia.br
```

## 5. Useful operations

```bash
# View logs
sudo journalctl -u omniroute -f

# Restart
sudo systemctl restart omniroute

# Reload nginx
sudo nginx -t && sudo systemctl reload nginx

# Renew certs manually (test)
sudo certbot renew --dry-run
```

## 6. What the installer configures

- Installs dependencies: `git`, `curl`, build tools, `nginx`, `certbot`, `ufw`
- Installs Node.js 22.x from NodeSource
- Clones/updates OmniRoute repository
- Runs `npm ci` and `npm run build`
- Creates systemd service: `omniroute.service`
- Creates Nginx site with reverse proxy to app port
  - Nginx file: `/etc/nginx/sites-available/onimiroute.conf`
- Enables UFW (`OpenSSH`, `Nginx Full`)
- Issues TLS certificate with Certbot (unless `--skip-certbot`)

## 7. Notes for Ubuntu 20.04

- Ubuntu 20.04 is in maintenance lifecycle; keep packages updated.
- If you plan long-term production, consider Ubuntu 22.04+.
- OmniRoute requires modern Node runtime; this guide installs Node 22.x.

## 8. Related docs

- [VM Deployment Guide](/home/paablo/Documentos/OmniRoute/docs/ops/VM_DEPLOYMENT_GUIDE.md)
- [Environment Variables](/home/paablo/Documentos/OmniRoute/docs/reference/ENVIRONMENT.md)
