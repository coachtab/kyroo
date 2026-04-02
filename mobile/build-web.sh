#!/usr/bin/env bash
set -e

echo "Building Expo web..."
npx expo export --platform web

echo "Injecting PWA meta tags..."
# Insert PWA tags before </head>
sed -i 's|</head>|  <meta name="theme-color" content="#F0EDE6" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-status-bar-style" content="default" />\n    <meta name="apple-mobile-web-app-title" content="Kyroo" />\n    <link rel="apple-touch-icon" href="/assets/icon.png" />\n    <link rel="manifest" href="/manifest.webmanifest" />\n  </head>|' dist/index.html

echo "Copying manifest..."
cp public/manifest.webmanifest dist/manifest.webmanifest

echo "Copying app icon for apple-touch-icon..."
cp assets/icon.png dist/assets/icon.png 2>/dev/null || true

echo "Done."
