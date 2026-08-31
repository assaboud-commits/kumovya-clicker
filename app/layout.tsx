import type { Metadata, Viewport } from 'next';
import type { CSSProperties } from 'react';
import Script from 'next/script';
import { assetPath } from './asset-path';
import './globals.css';

const siteUrl = 'https://assaboud-commits.github.io/kumovya-clicker/';
const socialImageUrl = new URL('og.png', siteUrl).href;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Кумовья — семейно-экономический кликкер',
  description: 'Нажимай на кума Валеру, копи авторитет и строй империю сомнительных связей.',
  icons: { icon: assetPath('game/kum-valera.png') },
  openGraph: {
    title: 'Кумовья — семейно-экономический кликкер',
    description: 'Семья — это святое. Особенно когда всё записано на неё.',
    url: siteUrl,
    siteName: 'Кумовья',
    locale: 'ru_RU',
    type: 'website',
    images: [{ url: socialImageUrl, width: 1672, height: 941, alt: 'Кумовья' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Кумовья — семейно-экономический кликкер',
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
    <html lang="ru">
      <head><Script src="https://telegram.org/js/telegram-web-app.js?63" strategy="beforeInteractive" /></head>
      <body style={artworkStyle}>{children}</body>
    </html>
  );
}
