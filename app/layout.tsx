import type { Metadata, Viewport } from 'next';
import type { CSSProperties } from 'react';
import { assetPath } from './asset-path';
import './globals.css';

const siteUrl = 'https://assaboud-commits.github.io/kumovya-clicker/';
const socialImageUrl = new URL('og.png', siteUrl).href;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Кумовья — Большая семейка',
  description: 'Семь глав и семеро своих, включая двоих с того света. Строй семейную империю от гаража до преисподней в кликкере с чёрным юмором.',
  icons: { icon: assetPath('game/kum-valera.png') },
  openGraph: {
    title: 'Кумовья — Большая семейка',
    description: 'Семья — это святое. Особенно когда всё записано на неё.',
    url: siteUrl,
    siteName: 'Кумовья',
    locale: 'ru_RU',
    type: 'website',
    images: [{ url: socialImageUrl, width: 1672, height: 941, alt: 'Кумовья' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Кумовья — Большая семейка',
    description: 'Семья — это святое. Особенно когда всё записано на неё.',
    images: [socialImageUrl],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#090806',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const artworkStyle = {
    '--scene-background': `url("${assetPath('game/background.png')}")`,
    '--upgrades-image': `url("${assetPath('game/upgrades.png')}")`,
  } as CSSProperties;
  return (
    <html lang="ru" suppressHydrationWarning>
      <head><script defer src="https://telegram.org/js/telegram-web-app.js?63" /></head>
      <body style={artworkStyle}>{children}</body>
    </html>
  );
}
