'use client';

import { KoyaWordmark } from '@/components/marketing/koya-mark';
import { Button } from '@/components/ui/button';
import { SiDiscord, SiGithub, SiX } from '@icons-pack/react-simple-icons';
import { Mail } from 'lucide-react';
import type { ComponentType } from 'react';

interface FooterLink {
  label: string;
  href: string;
}
interface FooterCol {
  title: string;
  links: FooterLink[];
}
interface FooterSettings {
  social_x_url?: string | null;
  social_discord_url?: string | null;
  social_github_url?: string | null;
  contact_email?: string | null;
  site_description?: string | null;
}

const defaultColumns = [
  {
    title: 'Product',
    links: [
      { label: 'Convert', href: '/convert' },
      { label: 'How It Works', href: '/#how-it-works' },
      { label: 'Cards', href: '/#cards' },
      { label: 'Security', href: '/#security' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Security', href: '/security' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/legal/privacy-policy' },
      { label: 'Terms of Service', href: '/legal/terms-of-service' },
    ],
  },
] as FooterCol[];

function buildSocials(settings?: FooterSettings) {
  return [
    { label: 'X', href: settings?.social_x_url || '#', icon: SiX, isLucide: false },
    { label: 'Discord', href: settings?.social_discord_url || '#', icon: SiDiscord, isLucide: false },
    { label: 'GitHub', href: settings?.social_github_url || '#', icon: SiGithub, isLucide: false },
    {
      label: 'Email',
      href: settings?.contact_email ? `mailto:${settings.contact_email}` : 'mailto:hello@koya.finance',
      icon: Mail,
      isLucide: true,
    },
  ];
}

export function SiteFooter({
  footerColumns,
  settings,
}: {
  footerColumns?: FooterCol[];
  settings?: FooterSettings;
} = {}) {
  const columns = footerColumns?.length ? footerColumns : defaultColumns;
  const socials = buildSocials(settings);

  return (
    <footer className="border-t border-white/10 bg-[#0a0a0a]">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="mb-10 rounded-xl border border-white/12 bg-[#141414] p-6 sm:p-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold">Built in Kenya. Designed for global finance.</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-white-95 sm:text-4xl">
            Convert capital with clarity, then operate from one trusted system.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
            Koya connects M-Pesa funding, multi-currency wallets, conversion, and spending into one accountable product surface.
          </p>
          <div className="mt-6">
            <Button size="lg" asChild>
              <a href="/convert">Start conversion</a>
            </Button>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <KoyaWordmark markSize={22} textSize="text-lg" id="footer" />
            <p className="mt-5 max-w-md text-sm leading-7 text-white/56">
              {settings?.site_description ||
                'Koya is a premium financial platform connecting local rails to global financial utility through disciplined product design.'}
            </p>

            <div className="mt-6 flex items-center gap-2">
              {socials.map((social) => {
                const Icon = social.icon as ComponentType<{ size?: number; className?: string }>;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-[#121212] text-white/56 transition-colors hover:border-white/20 hover:text-white"
                  >
                    {social.isLucide ? <Icon size={15} /> : <Icon size={13} />}
                  </a>
                );
              })}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3 lg:col-span-7">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="mb-4 text-[11px] uppercase tracking-[0.16em] text-white/36">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className="text-sm text-white/58 transition-colors hover:text-white/88">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-5 text-xs text-white/32">
          © {new Date().getFullYear()} Koya. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
