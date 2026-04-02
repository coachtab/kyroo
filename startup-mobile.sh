#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo ""
echo "  +======================================+"
echo "  |     KYROO MOBILE - Starting Up       |"
echo "  +======================================+"
echo ""

# -- Check Node.js --
if ! command -v node &>/dev/null; then
    echo "  [ERROR] Node.js is not installed."
    exit 1
fi

# -- Check npm --
if ! command -v npm &>/dev/null; then
    echo "  [ERROR] npm is not installed."
    exit 1
fi

# -- Install dependencies --
echo "  [1/2] Checking dependencies..."
cd mobile
if [ ! -d "node_modules" ]; then
    echo "        Installing npm packages..."
    npm install --legacy-peer-deps --silent 2>/dev/null
    echo "        Done."
else
    echo "        Dependencies OK."
fi

# -- Kill any existing process on port 8081 --
lsof -ti:8081 2>/dev/null | xargs kill -9 2>/dev/null || true

echo "  [2/2] Starting Expo..."
echo ""
echo "  +======================================+"
echo "  |  KYROO MOBILE running on Expo        |"
echo "  |  Web:    http://localhost:8081        |"
echo "  |  Mobile: scan QR with Expo Go        |"
echo "  |  Press Ctrl+C to stop               |"
echo "  +======================================+"
echo ""
echo "  Expo will open the browser automatically once the bundle is ready."
echo "  Android:  npm run android (requires Android Studio)"
echo "  iOS:      npm run ios     (requires macOS + Xcode)"
echo ""

# Expo --web opens the browser itself when the bundle is ready — no manual open needed
npx expo start --web --clear
