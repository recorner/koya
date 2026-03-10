'use client';

import { KoyaWordmark } from '@/components/marketing/koya-mark';
import { SiX, SiDiscord, SiGithub } from '@icons-pack/react-simple-icons';
import { Mail } from 'lucide-react';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Wallets', href: '#products' },
      { label: 'Convert', href: '#products' },
      { label: 'Cards', href: '#cards' },
      { label: 'Investing', href: '#investing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Press', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '#' },
      { label: 'Privacy Policy', href: '#' },
      { label: 'Compliance', href: '#' },
      { label: 'AML Policy', href: '#' },
    ],
  },
];

const socials = [
  { label: 'X', href: '#', icon: SiX },
  { label: 'Discord', href: '#', icon: SiDiscord },
  { label: 'GitHub', href: '#', icon: SiGithub },
  { label: 'Email', href: 'mailto:hello@koya.finance', icon: Mail },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white-5 bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-16">
        {/* Top row */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <KoyaWordmark markSize={22} textSize="text-lg" id="footer" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white-40">
              The borderless financial operating system for Africa and beyond.
            </p>

            {/* Social icons */}
            <div className="mt-6 flex items-center gap-3">
              {socials.map((social) => {
                const Icon = social.icon;
                // Lucide icons use `size`, simple-icons use `width`/`height`
                const isLucide = social.icon === Mail;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white-5 bg-white-5/30 text-white-40 transition-all duration-200 hover:border-white-10 hover:bg-white-5 hover:text-white-80 focus-visible:ring-1 focus-visible:ring-gold/40 focus-visible:outline-none"
                  >
                    {isLucide ? (
                      <Icon size={16} strokeWidth={1.5} />
                    ) : (
                      <Icon size={14} />
                    )}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <p className="mb-4 text-xs font-semibold tracking-[0.15em] uppercase text-white-60">
                {col.title}
              </p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-white-40 transition-colors hover:text-white-80"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white-5 pt-8 sm:flex-row">
          <p className="text-xs text-white-20">
            &copy; {new Date().getFullYear()} Koya. All rights reserved.
          </p>
          <p className="text-xs text-white-20">
            Built for the borderless generation.
          </p>
        </div>
      </div>
    </footer>
  );
}
