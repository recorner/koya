'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRightLeft,
  ChevronRight,
  CreditCard,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { BtcIcon, KesIcon, UsdcIcon, UsdIcon } from '@/components/marketing/asset-icons';
import { KoyaMark, KoyaWordmark } from '@/components/marketing/koya-mark';
import { GuestSwapWidget } from '@/components/marketing/guest-swap-widget';
import { Button } from '@/components/ui/button';

const ease = [0.22, 1, 0.36, 1] as const;

/* ─── Mastercard logo ──────────────────────────────────────────── */
function MastercardLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 30" fill="none" className={className}>
      <circle cx="18" cy="15" r="12" fill="#EB001B" opacity="0.85" />
      <circle cx="30" cy="15" r="12" fill="#F79E1B" opacity="0.85" />
      <path
        d="M24 5.6a11.96 11.96 0 0 0-4.4 9.4c0 3.76 1.73 7.12 4.4 9.4a11.96 11.96 0 0 0 4.4-9.4c0-3.76-1.73-7.12-4.4-9.4Z"
        fill="#FF5F00"
        opacity="0.9"
      />
    </svg>
  );
}

/* ─── Premium card visual — proper credit card ratio (85.6:53.98 ≈ 1.586) ── */
function PremiumCardSurface() {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-2xl sm:rounded-[28px] border border-white/12',
        'bg-[linear-gradient(145deg,#0C0D11_0%,#21242B_18%,#50545E_45%,#1A1D23_68%,#090A0E_100%)]',
        'shadow-[0_30px_96px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.14)]',
        'aspect-[1.586/1] w-full',
      ].join(' ')}
    >
      {/* Radial glow accents */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(240,208,96,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)]" />

      {/* Holographic shimmer */}
      <motion.div
        className="pointer-events-none absolute inset-y-0 left-[-45%] w-[42%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)] mix-blend-screen"
        animate={{ x: ['0%', '280%'] }}
        transition={{ duration: 4.6, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
      />

      {/* Holographic foil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-color-dodge"
        style={{
          backgroundImage: 'linear-gradient(135deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)',
          backgroundSize: '300% 300%',
          animation: 'holo-shift 8s ease-in-out infinite',
        }}
      />

      {/* Top gold line */}
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(212,175,55,0.42),transparent)]" />

      {/* Card content — positioned absolutely to fill the aspect-ratio box */}
      <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-6">
        {/* Top row: logo + badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <KoyaWordmark markSize={22} textSize="text-base" id="hero-card" />
          </div>
          <span className="rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-white/45">
            Premier
          </span>
        </div>

        {/* Middle: chip + Mastercard */}
        <div className="flex items-center justify-between gap-4">
          <div className="h-[26px] w-[36px] rounded-[5px] bg-[linear-gradient(145deg,#C9A030_0%,#D4AF37_42%,#8B6914_100%)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),0_2px_8px_rgba(0,0,0,0.35)]">
            <div className="mx-auto mt-[6px] h-[10px] w-[18px] rounded-[2px] border border-[rgba(107,79,0,0.55)] bg-[linear-gradient(180deg,rgba(240,208,96,0.3),rgba(139,105,20,0.24))]" />
          </div>
          <MastercardLogo className="h-6 w-auto opacity-90" />
        </div>

        {/* Card number */}
        <p className="font-mono text-lg tracking-[0.28em] text-white/80 sm:text-xl sm:tracking-[0.3em]">
          •••• •••• •••• 4821
        </p>

        {/* Bottom: currencies + expiry */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[8px] uppercase tracking-[0.14em] text-white/25">Spend from</p>
            <div className="mt-1 flex items-center gap-1.5">
              <KesIcon size={16} />
              <UsdIcon size={16} />
              <BtcIcon size={16} />
              <UsdcIcon size={16} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] uppercase tracking-[0.14em] text-white/25">Expiry</p>
            <p className="mt-0.5 font-mono text-xs text-white/70">09/29</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Desktop hero visual — card with hover-to-swap ────────────── */
function DesktopHeroVisual() {
  const [showSwap, setShowSwap] = useState(false);
  const [locked, setLocked] = useState(false);

  return (
    <div className="relative hidden lg:block">
      {/* Background glow */}
      <div className="pointer-events-none absolute left-[8%] top-[10%] h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.12),transparent_68%)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[8%] right-[10%] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.07),transparent_72%)] blur-3xl" />

      <div
        className="relative"
        onMouseEnter={() => { if (!locked) setShowSwap(true); }}
        onMouseLeave={() => { if (!locked) setShowSwap(false); }}
      >
        <AnimatePresence mode="wait">
          {showSwap ? (
            <motion.div
              key="swap"
              initial={{ opacity: 0, rotateY: 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: -90 }}
              transition={{ duration: 0.38, ease }}
              style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
              onClickCapture={() => setLocked(true)}
              onFocusCapture={() => setLocked(true)}
            >
              <GuestSwapWidget />
              {locked && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocked(false);
                    setShowSwap(false);
                  }}
                  className="mx-auto mt-2 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80"
                >
                  <X className="h-3 w-3" />
                  Back to card
                </motion.button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="card"
              initial={{ opacity: 0, rotateY: -90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: 90 }}
              transition={{ duration: 0.38, ease }}
              style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
              className="mx-auto max-w-[440px]"
            >
              <PremiumCardSurface />
              <p className="mt-2 text-center text-[10px] uppercase tracking-[0.14em] text-white/26">
                Hover to try live conversion
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Mobile hero visual — card only (swap widget lives below) ── */
function MobileHeroVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay: 0.2, ease }}
      className="mt-6 lg:hidden"
    >
      <div className="mx-auto max-w-[360px]">
        <PremiumCardSurface />
      </div>
    </motion.div>
  );
}

/* ─── Value props ──────────────────────────────────────────────── */
const valueProps = [
  { icon: Wallet, title: 'M-Pesa funding', detail: 'Deposit locally, hold globally.' },
  { icon: ArrowRightLeft, title: 'Instant conversion', detail: 'KES to BTC at live rates.' },
  { icon: CreditCard, title: 'Premium cards', detail: 'Spend from any wallet balance.' },
] as const;

/* ─── Main hero export ─────────────────────────────────────────── */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.14),transparent_26%),radial-gradient(circle_at_78%_22%,rgba(0,229,255,0.08),transparent_18%),linear-gradient(180deg,#050506_0%,#090B12_42%,#050506_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_32%,rgba(255,255,255,0.015)_68%,transparent_100%)]" />
      <div className="absolute inset-0 -z-10 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:96px_96px]" />

      <div className="mx-auto grid max-w-7xl gap-8 px-5 pt-4 pb-12 sm:px-6 md:px-8 md:pt-6 md:pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(380px,1fr)] lg:items-center lg:gap-10 lg:px-10 lg:pt-8 lg:pb-20 xl:px-12">
        {/* Left — copy */}
        <div className="max-w-[560px]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 backdrop-blur-md"
          >
            <KoyaMark size={18} id="hero-badge" />
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/65">
              Multi-currency account
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.04, ease }}
            className="mt-4 font-display text-[2rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.4rem] xl:text-[4rem]"
          >
            Fund via M-Pesa.{' '}
            <span className="text-transparent [background-image:linear-gradient(180deg,#F3D971_0%,#D4AF37_58%,#8B6914_100%)] bg-clip-text">
              Convert, hold, and spend globally.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease }}
            className="mt-4 max-w-lg text-sm leading-6 text-white/54 sm:text-base sm:leading-7 md:text-lg md:leading-8"
          >
            Multi-currency wallets, live Bitcoin conversion, and premium cards — all from one Koya account.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16, ease }}
            className="mt-5 flex flex-wrap items-center gap-3"
          >
            <Button size="lg" asChild>
              <Link href="/convert">
                Start a conversion
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </motion.div>

          {/* Value props */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22, ease }}
            className="mt-6 flex flex-wrap gap-5"
          >
            {valueProps.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/18 bg-gold/10 text-gold">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/84">{item.title}</p>
                    <p className="text-[11px] text-white/40">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Mobile card only — no swap here */}
          <MobileHeroVisual />
        </div>

        {/* Right — visual */}
        <DesktopHeroVisual />
      </div>
    </section>
  );
}
