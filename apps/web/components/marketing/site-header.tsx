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
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500',
        scrolled
          ? 'bg-vault-black/90 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-lg'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
        {/* Logo */}
        <a href="/" aria-label="Koya Home">
          <KoyaWordmark markSize={24} textSize="text-xl" id="header" />
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white-60 transition-colors hover:text-white-95"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
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

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white-5/50 bg-vault-black/95 backdrop-blur-lg md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3 sm:px-6 sm:py-4">
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
