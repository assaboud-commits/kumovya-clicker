import type { Metadata } from 'next';
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
