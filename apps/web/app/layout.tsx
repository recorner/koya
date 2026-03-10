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
    default: 'Koya — Borderless Finance',
    template: '%s | Koya',
  },
  description:
    'The borderless financial operating system. Convert, hold, and move money across currencies and borders.',
  icons: {
    icon: '/logo-icon.svg',
    apple: '/logo-icon.svg',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Koya — Borderless Finance',
    description:
      'The borderless financial operating system. Convert, hold, and move money across currencies and borders.',
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
