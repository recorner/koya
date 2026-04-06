import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-vault-black text-white">
      <h1 className="font-display text-6xl font-bold">404</h1>
      <p className="mt-4 text-lg text-white/60">Page not found</p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-vault-black transition-colors hover:bg-white/90"
      >
        Go home
      </Link>
    </div>
  );
}
