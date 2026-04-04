import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#F0EDE6" />
        <meta name="description" content="Kyroo — Dein KI-gestützter Fitness-Coach" />

        {/* PWA */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Kyroo" />
        <link rel="apple-touch-icon" href="/assets/icon.png" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
