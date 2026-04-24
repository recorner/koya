import type { Metadata, Viewport } from 'next';
import { Inter, Syne, IBM_Plex_Mono } from 'next/font/google';
import { getGlobalSettings, getSeoDefaults, getBranding } from '@/lib/cms';
import './globals.css';

const inter = Inter({
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

const ibmPlexMono = IBM_Plex_Mono({
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
    themeColor: branding?.theme_color || '#080808',
    colorScheme: 'dark',
  };
}

function safeHexColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(trimmed) ? trimmed : null;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getBranding();
  const accent = safeHexColor(branding?.primary_color) || '#C8963C';

  return (
    <html
      lang="en"
      className={`${inter.variable} ${syne.variable} ${ibmPlexMono.variable}`}
      style={{ ['--color-accent' as string]: accent }}
    >
      <body>{children}</body>
    </html>
  );
}
