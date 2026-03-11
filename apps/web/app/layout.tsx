import type { Metadata, Viewport } from 'next';
import { DM_Sans, Syne, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['700', '800'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: {
    default: 'Koya — Your Money, Every Currency, One Platform',
    template: '%s | Koya',
  },
  description:
    'Deposit via M-Pesa. Hold KES, USD, BTC, and stablecoins. Convert instantly. Spend with a premium card. Invest in U.S. stocks. All from one Koya account.',
  icons: {
    icon: '/logo-icon.svg',
    apple: '/logo-icon.svg',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Koya — Your Money, Every Currency, One Platform',
    description:
      'Deposit via M-Pesa. Hold KES, USD, BTC, and stablecoins. Convert instantly. Spend with a premium card. Invest in U.S. stocks. All from one Koya account.',
    locale: 'en_US',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#070708',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${syne.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
