# Strato Server — Infrastructure Reference

> Provide this file to any project that will be deployed on this server.
> It describes the server environment, installed tooling, and standard deployment procedures.

---

## Server Specifications

| Field | Value |
|---|---|
| Provider | Strato Dedicated Server |
| IPv4 | `93.90.201.90` |
| IPv6 | `2a02:2479:aa:9200::1` |
| OS | Ubuntu 24.04.4 LTS (noble) |
| CPU | 4 cores |
| RAM | 8 GB |
| Storage | 240 GB |
| Root user | `root` |
| App user | `deploy` (non-root, Docker access) |

## SSH Access

```bash
ssh -i ~/.ssh/coachtap_strato root@93.90.201.90
```

- Key type: Ed25519
- Local key path (Windows): `C:\Users\KamaraO\.ssh\coachtap_strato`
- The `deploy` user runs applications; `root` is used for system-level config only.

---

## Installed Software

| Software | Version | Purpose |
|---|---|---|
| Node.js | v20.20.0 | JavaScript runtime |
| npm | 10.8.2 | Package manager |
| Docker | 29.3.1 | Containerized services (databases, caches, etc.) |
| Docker Compose | (bundled) | Multi-container orchestration |
| Nginx | 1.24.0 | Reverse proxy, SSL termination |
| PM2 | latest | Process manager with auto-restart on reboot |
| Certbot | latest | Free SSL certificates via Let's Encrypt |
| Git | latest | Version control |
| Claude Code | 2.1.85+ | AI coding assistant (installed for root user) |

## Firewall (UFW — active)

| Port | Protocol | Purpose |
|---|---|---|
| 22 | TCP | SSH |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS |

To open additional ports: `ufw allow <port>` (as root).

---

## Standard Deployment Guide

### Step 1 — Clone the project

```bash
su - deploy
git clone https://github.com/<org>/<repo>.git
cd <repo>
```

All projects live under `/home/deploy/<project-name>/`.

### Step 2 — Environment variables

```bash
cp .env.example .env
nano .env   # fill in production values
```

Generate secrets with: `openssl rand -base64 32`

### Step 3 — Start backing services (if needed)

If the project uses PostgreSQL, Redis, or other services via Docker Compose:

```bash
docker compose up -d
```

> **Port allocation:** Each project must use unique host ports to avoid conflicts.
> Check existing port usage with: `ss -tlnp`

### Step 4 — Install, migrate, build

```bash
npm install
npx prisma migrate deploy   # if using Prisma
npm run build
```

### Step 5 — Start with PM2

```bash
pm2 start npm --name "<project-name>" -- start
pm2 save
```

PM2 is configured to auto-start all saved processes on system reboot.

### Step 6 — Configure Nginx reverse proxy

As `root`, create the Nginx config:

```bash
cat > /etc/nginx/sites-available/<project-name> << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name <domain-or-ip>;

    location / {
        proxy_pass http://127.0.0.1:<app-port>;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/<project-name> /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### Step 7 — SSL with a domain (optional but recommended)

Point your domain's DNS A record to `93.90.201.90`, then:

```bash
certbot --nginx -d <domain> -d www.<domain>
```

Certbot auto-configures HTTPS and sets up auto-renewal.

> **Note:** SSL certificates require a domain name. They cannot be issued for IP addresses.

---

## Common Operations

### PM2 (process management)

```bash
su - deploy
pm2 status                          # list all running apps
pm2 logs <project-name>             # view logs
pm2 restart <project-name>          # restart app
pm2 stop <project-name>             # stop app
pm2 delete <project-name>           # remove from PM2
pm2 list                            # overview of all processes
pm2 save                            # persist current process list
```

### Docker (backing services)

```bash
docker ps                            # list running containers
docker compose up -d                 # start containers (from project dir)
docker compose down                  # stop containers
docker compose logs -f               # tail logs
docker volume ls                     # list persistent volumes
```

### Nginx (reverse proxy)

```bash
nginx -t                             # test config syntax
systemctl reload nginx               # apply config changes
systemctl restart nginx              # full restart
ls /etc/nginx/sites-enabled/         # list active sites
```

### System

```bash
ufw status                           # firewall rules
df -h                                # disk usage
free -h                              # memory usage
htop                                 # live resource monitor (install: apt install htop)
```

---

## Redeployment Workflow

For updating an existing project with new code:

```bash
su - deploy
cd ~/<project-name>
git pull
npm install
npx prisma migrate deploy   # if applicable
npm run build
pm2 restart <project-name>
```

---

## Currently Deployed Projects

| Project | Port | Domain | PM2 Name | Docker Services |
|---|---|---|---|---|
| CoachTap | 3000 | http://93.90.201.90 | coachtap | postgres:5499, redis:6379 |

> Update this table as new projects are added to prevent port conflicts.

---

## Conventions

- **One project = one directory** under `/home/deploy/`
- **One Nginx config** per project in `/etc/nginx/sites-available/`
- **Unique ports** for each app and each Docker service — check the table above
- **PM2 names** should match the project directory name
- **Environment files** (`.env`) are never committed — each project maintains its own on the server
- **Docker volumes** persist data — deleting a container does not delete data
- **Root for system config only** — apps always run as the `deploy` user
