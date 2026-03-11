'use client';

import { KoyaWordmark } from '@/components/marketing/koya-mark';
import { Button } from '@/components/ui/button';
import { SiX, SiDiscord, SiGithub } from '@icons-pack/react-simple-icons';
import {
  ArrowUpRight,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

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
    <footer className="relative overflow-hidden border-t border-white/6 bg-[linear-gradient(180deg,#090909_0%,#050505_100%)]">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[8%] h-40 w-40 rounded-full bg-[rgba(212,175,55,0.07)] blur-3xl" />
        <div className="absolute right-[8%] bottom-[12%] h-44 w-44 rounded-full bg-[rgba(0,229,255,0.05)] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-16 md:py-20">
        {/* top CTA panel */}
        <div className="mb-14 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-md md:p-8">
          <div className="grid items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">
                <Sparkles className="h-4 w-4 text-[rgba(212,175,55,0.95)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  Built in Kenya. Built for the world.
                </span>
              </div>

              <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                Built for people whose money
                <span className="block bg-[linear-gradient(180deg,#F0D060_0%,#D4AF37_48%,#A88520_100%)] bg-clip-text text-transparent">
                  should work as hard as they do
                </span>
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
                Hold multiple currencies, convert instantly, spend with premium
                cards, and invest globally — all from one Koya account.
              </p>
            </div>

            <div className="lg:col-span-4">
              <div className="flex flex-col gap-3 lg:items-end">
                <Button size="lg" className="group min-w-[190px]">
                  Join Waitlist
                  <ArrowUpRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Button>

                <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2">
                  <ShieldCheck className="h-4 w-4 text-[rgba(212,175,55,0.90)]" />
                  <span className="text-[11px] text-white/52">
                    Kenya-based · Regulated
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* main footer grid */}
        <div className="grid gap-12 lg:grid-cols-12">
          {/* brand column */}
          <div className="lg:col-span-5">
            <KoyaWordmark markSize={24} textSize="text-xl" id="footer" />

            <p className="mt-5 max-w-md text-sm leading-7 text-white/56">
              Koya is a premium financial platform built in Kenya —
              connecting M-Pesa deposits, multi-currency wallets, cards, and
              investing into one account.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {['KES', 'USD', 'BTC', 'USDC', 'USDT'].map((asset) => (
                <span
                  key={asset}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/56"
                >
                  {asset}
                </span>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-3">
              {socials.map((social) => {
                const Icon = social.icon;
                const isLucide = social.icon === Mail;

                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] text-white/46 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(212,175,55,0.18)] hover:text-white/82"
                  >
                    {isLucide ? (
                      <Icon size={16} strokeWidth={1.6} />
                    ) : (
                      <Icon size={14} />
                    )}
                  </a>
                );
              })}
            </div>
          </div>

          {/* link columns */}
          <div className="grid gap-10 sm:grid-cols-3 lg:col-span-7">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/34">
                  {col.title}
                </p>

                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="group inline-flex items-center gap-2 text-sm text-white/56 transition-colors duration-200 hover:text-white"
                      >
                        <span>{link.label}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-white/18 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[rgba(212,175,55,0.80)]" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* bottom bar */}
        <div className="mt-14 flex flex-col gap-4 border-t border-white/6 pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-white/32">
            © {new Date().getFullYear()} Koya. All rights reserved.
          </p>

          <div className="flex flex-col gap-2 text-xs text-white/32 md:flex-row md:items-center md:gap-6">
            <span>Built in Kenya. Built for the world.</span>
            <span className="hidden md:inline">•</span>
            <span>M-Pesa · Multi-currency · Cards · Investing</span>
          </div>
        </div>
      </div>
    </footer>
  );
}