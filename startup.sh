#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo ""
echo "  +======================================+"
echo "  |        KYROO - Starting Up           |"
echo "  +======================================+"
echo ""

# -- Load .env --
if [ -f .env ]; then
    while IFS='=' read -r key value; do
        [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
        export "$key=$value"
    done < .env
fi

# -- Check Docker --
if ! command -v docker &>/dev/null; then
    echo "  [ERROR] Docker is not installed."
    exit 1
fi

# -- Check Node.js --
if ! command -v node &>/dev/null; then
    echo "  [ERROR] Node.js is not installed."
    exit 1
fi

# -- Start database in Docker --
echo "  [1/4] Starting database..."
docker compose up -d --wait 2>/dev/null
echo "        Database ready."

# -- Install dependencies --
echo "  [2/4] Checking dependencies..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "        Installing npm packages..."
    npm install --silent 2>/dev/null
else
    echo "        Dependencies OK."
fi
cd ..

# -- Kill any existing process on port 3001 --
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true

# -- Start the server --
echo "  [3/4] Starting server..."
node backend/server.js &
SERVER_PID=$!

# -- Open browser --
echo "  [4/4] Opening browser..."
sleep 2
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:3001" &>/dev/null &
elif command -v open &>/dev/null; then
    open "http://localhost:3001"
fi

echo ""
echo "  +======================================+"
echo "  |   KYROO running at localhost:3001    |"
echo "  |   Press Ctrl+C to stop              |"
echo "  +======================================+"
echo ""
echo "  Database: Docker (kyroo-db)"
echo "  Server:   Node.js (localhost:3001)"
echo ""
echo "  To stop everything:"
echo "    Ctrl+C (server)"
echo "    docker compose down (database)"
echo ""

# Keep alive and forward Ctrl+C
trap "kill $SERVER_PID 2>/dev/null; exit" INT TERM
wait $SERVER_PID
