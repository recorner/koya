'use client';

import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { KoyaWordmark } from '@/components/marketing/koya-mark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const defaultNavLinks = [
  { label: 'Products', href: '#products' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Security', href: '#security' },
  { label: 'Cards', href: '#cards' },
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
  const ctaItem = navItems?.find((n) => n.is_cta) || { label: 'Convert', href: '/convert' };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b border-white/10 transition-colors duration-300',
        scrolled ? 'bg-[#0b0b0b]/96 backdrop-blur-sm' : 'bg-[#090909]/92',
      )}
    >
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-5 sm:h-14 sm:px-6 lg:px-10">
        <a href="/" aria-label="Koya Home" className="shrink-0">
          <KoyaWordmark markSize={22} textSize="text-lg" id="header" />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/54 transition-colors hover:text-white/90"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button size="sm" asChild>
            <a href={ctaItem.href}>{ctaItem.label}</a>
          </Button>
        </div>

        <button
          className="text-white/80 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#0d0d0d] px-4 py-3 md:hidden sm:px-6">
          <nav className="flex flex-col gap-1.5">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md border border-transparent px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/14 hover:bg-white/[0.03] hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2">
              <Button size="sm" className="w-full" asChild>
                <a href={ctaItem.href}>{ctaItem.label}</a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
