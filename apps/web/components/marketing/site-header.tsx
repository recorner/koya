'use client';

import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { KoyaWordmark } from '@/components/marketing/koya-mark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const defaultNavLinks = [
  { label: 'Products', href: '#products' },
  { label: 'Security', href: '#security' },
  { label: 'Cards', href: '#cards' },
  { label: 'Investing', href: '#investing' },
];

interface NavLink {
  label: string;
  href: string;
  is_cta?: boolean;
}

export function SiteHeader({ navItems }: { navItems?: NavLink[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = navItems?.length ? navItems.filter((n) => !n.is_cta) : defaultNavLinks;
  const ctaItem = navItems?.find((n) => n.is_cta);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500',
        scrolled
          ? 'bg-vault-black/92 shadow-[0_4px_28px_rgba(0,0,0,0.55)] backdrop-blur-xl'
          : 'bg-[linear-gradient(180deg,rgba(10,10,12,0.96),rgba(7,7,8,0.88))] backdrop-blur-md',
      )}
    >
      {/* Gold accent line — matches ribbon top line for visual continuity */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(212,175,55,0.32),transparent)]" />

      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-5 sm:h-14 sm:px-6 lg:px-10">
        {/* Logo — larger */}
        <a href="/" aria-label="Koya Home" className="shrink-0">
          <KoyaWordmark markSize={26} textSize="text-xl" id="header" />
        </a>

        {/* Desktop nav — premium feel */}
        <nav className="hidden items-center gap-10 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/48 transition-colors duration-300 hover:text-white/90"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Button size="sm" asChild>
            <a href={ctaItem?.href ?? '#'}>{ctaItem?.label ?? 'Join Waitlist'}</a>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex items-center justify-center md:hidden text-white-80"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Bottom separator — matches ribbon border for unified look */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 h-px transition-opacity duration-500',
          scrolled
            ? 'bg-white/8 opacity-100'
            : 'bg-[linear-gradient(90deg,transparent,rgba(212,175,55,0.2),transparent)] opacity-100',
        )}
      />

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/6 bg-vault-black/95 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3 sm:px-6">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-white-60 transition-colors hover:bg-white-5 hover:text-white-95"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-white-5 pt-4">
              <Button size="sm" className="justify-center" asChild>
                <a href={ctaItem?.href ?? '#'}>{ctaItem?.label ?? 'Join Waitlist'}</a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
