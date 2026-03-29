#!/usr/bin/env bash
set -e

# KYROO Production Deploy Script
# Server: 93.90.201.90
# User: deploy

SERVER="93.90.201.90"
SSH_KEY="$HOME/.ssh/coachtap_strato"
DEPLOY_USER="deploy"
PROJECT="kyroo"
APP_PORT="3001"
DB_PORT="15433"

echo ""
echo "  +============================+"
echo "  |   KYROO - Deploy to Prod   |"
echo "  +============================+"
echo ""

# Step 1: Push code to git
echo "[1/6] Pushing code..."
git add -A
git commit -m "deploy: production release $(date +%Y-%m-%d)" --allow-empty
git push origin main

# Step 2: SSH and clone/pull
echo "[2/6] Updating code on server..."
ssh -i "$SSH_KEY" ${DEPLOY_USER}@${SERVER} << REMOTE
  cd ~
  if [ ! -d "$PROJECT" ]; then
    git clone https://github.com/buf/github/ct/kyroo.git $PROJECT
  fi
  cd $PROJECT
  git pull origin main
REMOTE

# Step 3: Create .env on server
echo "[3/6] Configuring environment..."
ssh -i "$SSH_KEY" ${DEPLOY_USER}@${SERVER} << REMOTE
  cd ~/$PROJECT
  if [ ! -f .env ]; then
    cat > .env << 'ENV'
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=surfkitching@gmail.com
SMTP_PASS=yrxw onqe vtio fwfa
JWT_SECRET=$(openssl rand -base64 32)
BASE_URL=http://${SERVER}:${APP_PORT}
PORT=${APP_PORT}
DB_HOST=127.0.0.1
DB_PORT=${DB_PORT}
DB_NAME=kyroo
DB_USER=kyroo
DB_PASSWORD=kyroo_pass
ENV
    echo "  .env created"
  else
    echo "  .env exists (skipping)"
  fi
REMOTE

# Step 4: Start database
echo "[4/6] Starting database..."
ssh -i "$SSH_KEY" ${DEPLOY_USER}@${SERVER} << REMOTE
  cd ~/$PROJECT
  export DB_PORT=${DB_PORT}
  docker compose up -d --wait
  echo "  Database ready"
REMOTE

# Step 5: Install deps
echo "[5/6] Installing dependencies..."
ssh -i "$SSH_KEY" ${DEPLOY_USER}@${SERVER} << REMOTE
  cd ~/$PROJECT/backend
  npm install --production
  echo "  Dependencies installed"
REMOTE

# Step 6: Start/restart with PM2
echo "[6/6] Starting application..."
ssh -i "$SSH_KEY" ${DEPLOY_USER}@${SERVER} << REMOTE
  cd ~/$PROJECT
  export \$(grep -v '^#' .env | while IFS='=' read -r key value; do echo "\$key=\$value"; done | xargs)
  pm2 describe $PROJECT > /dev/null 2>&1 && pm2 restart $PROJECT || pm2 start backend/server.js --name $PROJECT
  pm2 save
  echo "  Application running on port ${APP_PORT}"
REMOTE

echo ""
echo "  +============================+"
echo "  |   Deploy complete!         |"
echo "  |   http://${SERVER}:${APP_PORT}   |"
echo "  +============================+"
echo ""
