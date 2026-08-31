import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://kumovya-clicker.assa-boud.chatgpt.site'),
  title: 'Кумовья — семейно-экономический кликкер',
  description: 'Нажимай на кума Валеру, копи авторитет и строй империю сомнительных связей.',
  icons: { icon: '/game/kum-valera.png' },
  openGraph: {
    title: 'Кумовья — семейно-экономический кликкер',
    description: 'Семья — это святое. Особенно когда всё записано на неё.',
    url: '/',
    siteName: 'Кумовья',
    locale: 'ru_RU',
    type: 'website',
    images: [{ url: '/og.png', width: 1672, height: 941, alt: 'Кумовья' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Кумовья — семейно-экономический кликкер',
    description: 'Семья — это святое. Особенно когда всё записано на неё.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#090806',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head><Script src="https://telegram.org/js/telegram-web-app.js?63" strategy="beforeInteractive" /></head>
      <body>{children}</body>
    </html>
  );
}
