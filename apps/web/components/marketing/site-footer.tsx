import { KoyaWordmark } from '@/components/marketing/koya-mark';

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
  {
    title: 'Connect',
    links: [
      { label: 'Twitter / X', href: '#' },
      { label: 'Discord', href: '#' },
      { label: 'Email', href: '#' },
      { label: 'GitHub', href: '#' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white-5 bg-surface">
      <div className="mx-auto max-w-7xl px-6 py-16">
        {/* Top row */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-1">
            <KoyaWordmark markSize={22} textSize="text-lg" id="footer" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white-40">
              The borderless financial operating system for Africa and beyond.
            </p>
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
