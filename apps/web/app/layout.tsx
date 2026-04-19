import type { Metadata, Viewport } from 'next';
import { DM_Sans, Syne, JetBrains_Mono } from 'next/font/google';
import { getGlobalSettings, getSeoDefaults, getBranding } from '@/lib/cms';
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

export async function generateMetadata(): Promise<Metadata> {
  const [settings, seo, branding] = await Promise.all([
    getGlobalSettings(),
    getSeoDefaults(),
    getBranding(),
  ]);

  const siteName = settings?.site_name || 'Koya';
  const defaultTitle =
    settings?.default_meta_title || seo?.fallback_title || `${siteName} — Borderless Finance`;
  const description =
    settings?.default_meta_description ||
    seo?.fallback_description ||
    'Borderless finance for Africa and beyond.';
  const titleSuffix = seo?.title_suffix || ` | ${siteName}`;
  const ogImage =
    settings?.og_image || branding?.og_default_image || seo?.fallback_og_image || null;
  const favicon = branding?.logo_icon || '/logo-icon.svg';
  const appleIcon = branding?.apple_icon || favicon;

  return {
    title: {
      default: defaultTitle,
      template: `%s${titleSuffix}`,
    },
    description,
    icons: {
      icon: favicon,
      apple: appleIcon,
    },
    manifest: '/site.webmanifest',
    openGraph: {
      title: defaultTitle,
      description,
      locale: 'en_US',
      type: 'website',
      siteName,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: defaultTitle,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const branding = await getBranding();
  return {
    themeColor: branding?.theme_color || '#070708',
    colorScheme: 'dark',
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getBranding();
  const themeStyle = {
    ...(branding?.primary_color ? { '--color-gold': branding.primary_color } : {}),
    ...(branding?.background_color
      ? { '--color-vault-black': branding.background_color }
      : {}),
  } as React.CSSProperties;

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${syne.variable} ${jetbrainsMono.variable}`}
    >
      <body style={themeStyle}>{children}</body>
    </html>
  );
}
