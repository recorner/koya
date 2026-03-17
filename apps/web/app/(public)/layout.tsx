import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import {
  getNavigation,
  getFooterColumns,
  getGlobalSettings,
} from '@/lib/directus';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [navItems, footerColumns, settings] = await Promise.all([
    getNavigation(),
    getFooterColumns(),
    getGlobalSettings(),
  ]);

  // Normalize footer columns for the client component
  const footerCols = footerColumns.map((col) => ({
    title: col.title,
    links: Array.isArray(col.links)
      ? (col.links as { label: string; href: string }[]).map((l) => ({
          label: l.label,
          href: l.href,
        }))
      : [],
  }));

  return (
    <>
      <SiteHeader
        navItems={navItems.map((n) => ({
          label: n.label,
          href: n.href,
          is_cta: n.is_cta,
        }))}
      />
      <div className="overflow-x-hidden pt-16">{children}</div>
      <SiteFooter footerColumns={footerCols} settings={settings ?? undefined} />
    </>
  );
}
