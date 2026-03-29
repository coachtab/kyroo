# KYROO - Deployment Guide

## Server

| Field | Value |
|---|---|
| Provider | Strato Dedicated Server |
| IP | `93.90.201.90` |
| OS | Ubuntu 24.04 LTS |
| App URL | `http://93.90.201.90:3001` |
| Admin URL | `http://93.90.201.90:3001/admin.html` |
| API Docs | `http://93.90.201.90:3001/api-docs/` |
| App User | `deploy` |
| Root User | `root` (system config only) |
| SSH Key | `~/.ssh/coachtap_strato` |

## Port Allocation

| Service | Port | Notes |
|---|---|---|
| CoachTap (existing) | 3000 | Do not use |
| CoachTap Postgres | 5499 | Do not use |
| **KYROO App** | **3001** | Express + WebSocket |
| **KYROO Postgres** | **15433** | Docker container `kyroo-db` |

## Prerequisites

The server already has:
- Node.js v20
- npm
- Docker + Docker Compose
- PM2
- Nginx
- Git

---

## First-Time Deployment

### 1. SSH into the server

```bash
ssh -i ~/.ssh/coachtap_strato root@93.90.201.90
```

### 2. Clone the repository

```bash
su - deploy
cd ~
git clone https://github.com/coachtab/kyroo.git
cd kyroo
```

### 3. Create the environment file

```bash
cat > .env << 'EOF'
ANTHROPIC_API_KEY=your-anthropic-api-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-gmail-app-password
JWT_SECRET=generate-with-openssl-rand-base64-32
BASE_URL=http://93.90.201.90:3001
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=15433
DB_NAME=kyroo
DB_USER=kyroo
DB_PASSWORD=kyroo_pass
EOF
```

Generate a secure JWT secret:

```bash
openssl rand -base64 32
```

### 4. Start the database

```bash
export DB_PORT=15433
docker compose up -d --wait
```

Verify it is running:

```bash
docker ps | grep kyroo-db
```

### 5. Run database migrations

The `init.sql` runs automatically on first Docker start. Then run the additional migrations:

```bash
# Additional columns and tables
docker exec kyroo-db psql -U kyroo -d kyroo -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT true;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS consent_date TIMESTAMP DEFAULT NOW();
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
ALTER TABLE premium_articles ADD COLUMN IF NOT EXISTS video_url VARCHAR(500);
ALTER TABLE premium_articles ADD COLUMN IF NOT EXISTS video_duration FLOAT;
"

# Additional tables
docker cp db/migrate.sql kyroo-db:/tmp/migrate.sql
docker exec kyroo-db psql -U kyroo -d kyroo -f /tmp/migrate.sql

# Payment tables
docker exec kyroo-db psql -U kyroo -d kyroo -c "
CREATE TABLE IF NOT EXISTS payment_methods (id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, type VARCHAR(50) NOT NULL, label VARCHAR(150) NOT NULL, last_four VARCHAR(4), is_default BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, payment_method_id INT REFERENCES payment_methods(id), amount DECIMAL(10,2) NOT NULL, currency VARCHAR(10) DEFAULT 'EUR', description VARCHAR(255), status VARCHAR(50) DEFAULT 'completed', created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS article_images (id SERIAL PRIMARY KEY, article_id INT NOT NULL REFERENCES premium_articles(id) ON DELETE CASCADE, url VARCHAR(500) NOT NULL, caption VARCHAR(255), sort_order INT DEFAULT 0, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS site_settings (key VARCHAR(100) PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS footer_links (id SERIAL PRIMARY KEY, column_title VARCHAR(100) NOT NULL, label VARCHAR(100) NOT NULL, url VARCHAR(255) DEFAULT '#', sort_order INT DEFAULT 0, col_order INT DEFAULT 0);
"

# Footer links
docker exec kyroo-db psql -U kyroo -d kyroo -c "
INSERT INTO footer_links (column_title, label, url, col_order, sort_order) VALUES
('Platform', 'Explore', '#explore', 1, 1),
('Platform', 'Articles', '#articles', 1, 2),
('Platform', 'Premium', '#premium', 1, 3),
('Company', 'Privacy Policy', 'privacy', 2, 1),
('Company', 'Terms of Service', 'terms', 2, 2),
('Company', 'Imprint', 'imprint', 2, 3)
ON CONFLICT DO NOTHING;
"

# Legal content
docker cp db/legal.sql kyroo-db:/tmp/legal.sql
docker exec kyroo-db psql -U kyroo -d kyroo -f /tmp/legal.sql

# DSGVO privacy policy
docker cp db/dsgvo-update.sql kyroo-db:/tmp/dsgvo-update.sql
docker exec kyroo-db psql -U kyroo -d kyroo -f /tmp/dsgvo-update.sql

# Seed articles
docker cp db/seed-pberg.sql kyroo-db:/tmp/seed-pberg.sql
docker exec kyroo-db psql -U kyroo -d kyroo -f /tmp/seed-pberg.sql
```

### 6. Seed production data (admin user, settings, social links)

```bash
cd backend
NODE_PATH=./node_modules DB_PORT=15433 node ../db/seed-production.js
cd ..
```

### 7. Install Node.js dependencies

```bash
cd backend
npm install --production
cd ..
```

### 8. Create PM2 ecosystem file

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: "kyroo",
    script: "backend/server.js",
    env: {
      PORT: 3001,
      DB_HOST: "127.0.0.1",
      DB_PORT: 15433,
      DB_NAME: "kyroo",
      DB_USER: "kyroo",
      DB_PASSWORD: "kyroo_pass",
      JWT_SECRET: "REPLACE_WITH_GENERATED_SECRET",
      BASE_URL: "http://93.90.201.90:3001",
      ANTHROPIC_API_KEY: "REPLACE_WITH_YOUR_KEY",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: 587,
      SMTP_USER: "REPLACE_WITH_YOUR_EMAIL",
      SMTP_PASS: "REPLACE_WITH_APP_PASSWORD"
    }
  }]
};
EOF
```

### 9. Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
```

Verify:

```bash
pm2 logs kyroo --lines 5 --nostream
```

You should see:

```
Database connected.
KYROO API running on http://localhost:3001
WebSocket available at ws://localhost:3001/ws
```

### 10. Open firewall port (as root)

```bash
exit  # back to root
ufw allow 3001/tcp
```

### 11. Configure Nginx reverse proxy (as root)

Only needed if you want to serve KYROO on port 80 with a domain:

```bash
cat > /etc/nginx/sites-available/kyroo << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name kyroo.de www.kyroo.de;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3001;
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

ln -sf /etc/nginx/sites-available/kyroo /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 12. SSL with domain (optional)

Point your domain DNS A record to `93.90.201.90`, then:

```bash
certbot --nginx -d kyroo.de -d www.kyroo.de
```

---

## Redeployment (Code Updates)

### From local machine (quick)

```bash
git push origin main
ssh -i ~/.ssh/coachtap_strato root@93.90.201.90 \
  "su - deploy -c 'cd ~/kyroo && git pull && cd backend && npm install --production && pm2 restart kyroo'"
```

### On the server manually

```bash
ssh -i ~/.ssh/coachtap_strato root@93.90.201.90
su - deploy
cd ~/kyroo
git pull origin main
cd backend
npm install --production
pm2 restart kyroo
```

---

## Database Operations

### Connect to database

```bash
docker exec -it kyroo-db psql -U kyroo -d kyroo
```

### Backup database

```bash
docker exec kyroo-db pg_dump -U kyroo kyroo > ~/kyroo-backup-$(date +%Y%m%d).sql
```

### Restore database

```bash
docker exec -i kyroo-db psql -U kyroo -d kyroo < ~/kyroo-backup-YYYYMMDD.sql
```

### Reset database (destructive)

```bash
cd ~/kyroo
docker compose down -v
export DB_PORT=15433
docker compose up -d --wait
# Then re-run all migrations from Step 5
```

---

## Common Operations

### View logs

```bash
pm2 logs kyroo              # live logs
pm2 logs kyroo --lines 50   # last 50 lines
```

### Restart app

```bash
pm2 restart kyroo
```

### Stop app

```bash
pm2 stop kyroo
```

### Check status

```bash
pm2 status
docker ps
```

### Check database

```bash
docker exec kyroo-db psql -U kyroo -d kyroo -c "SELECT COUNT(*) FROM users"
docker exec kyroo-db psql -U kyroo -d kyroo -c "SELECT COUNT(*) FROM premium_articles"
docker exec kyroo-db psql -U kyroo -d kyroo -c "SELECT COUNT(*) FROM subscribers"
```

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `PORT` | App port (3001) | Yes |
| `DB_HOST` | Database host (127.0.0.1) | Yes |
| `DB_PORT` | Database port (15433) | Yes |
| `DB_NAME` | Database name (kyroo) | Yes |
| `DB_USER` | Database user (kyroo) | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `JWT_SECRET` | Token signing secret | Yes |
| `BASE_URL` | Public URL for email links | Yes |
| `ANTHROPIC_API_KEY` | Claude API key for AI articles | For AI features |
| `SMTP_HOST` | Email server host | For email delivery |
| `SMTP_PORT` | Email server port | For email delivery |
| `SMTP_USER` | Email sender address | For email delivery |
| `SMTP_PASS` | Email password (Gmail App Password) | For email delivery |

---

## Architecture

```
                    Internet
                       |
                   Nginx:80
                       |
            +----------+----------+
            |                     |
      CoachTap:3000          KYROO:3001
            |                     |
      Postgres:5499          Postgres:15433
      (Docker)               (Docker: kyroo-db)
```

---

## Troubleshooting

### App not starting

```bash
pm2 logs kyroo --lines 20    # check error logs
```

### Database connection error

```bash
docker ps | grep kyroo       # check container is running
docker logs kyroo-db         # check database logs
```

### Port already in use

```bash
ss -tlnp | grep 3001        # check what is using port 3001
pm2 delete kyroo             # remove old process
pm2 start ecosystem.config.js
```

### Email not sending

- Verify Gmail App Password (not regular password)
- Check `pm2 logs kyroo` for `[EMAIL]` entries
- Test SMTP: the server logs the verification link to console as fallback

### Reset admin password

```bash
docker exec kyroo-db psql -U kyroo -d kyroo -c "
  -- Generate hash with: node -e \"require('bcryptjs').hash('NewPass123', 10).then(h => console.log(h))\"
  UPDATE users SET password_hash = 'PASTE_HASH_HERE' WHERE email = 'okamara@gmail.com';
"
```

---

## Currently Deployed

| Field | Value |
|---|---|
| Git Repo | `https://github.com/coachtab/kyroo.git` |
| Branch | `main` |
| App Port | `3001` |
| DB Port | `15433` |
| PM2 Name | `kyroo` |
| Docker Container | `kyroo-db` |
| Admin Email | `okamara@gmail.com` |
| Deploy Path | `/home/deploy/kyroo/` |
