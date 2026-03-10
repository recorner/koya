'use client';

import { motion } from 'framer-motion';
import { ArrowRightLeft, ChevronRight, CreditCard, ShieldCheck, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { KoyaMark } from '@/components/marketing/koya-mark';
import { BtcIcon, UsdcIcon, UsdtIcon, KesIcon, UsdIcon } from '@/components/marketing/asset-icons';
import { Button } from '@/components/ui/button';

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

const currencies = ['KES', 'USD', 'BTC', 'USDC', 'USDT'];

const container = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: 'easeOut' as const },
  },
};

const fadeLeft = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: 'easeOut' as const },
  },
};

const fadeRight = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: 'easeOut' as const },
  },
};

const floatSoft = {
  animate: {
    y: [0, -8, 0],
    rotate: [0, 0.6, 0],
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
};

function GlassCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        'rounded-[28px] border border-white/10 bg-white/[0.06] backdrop-blur-md shadow-[0_20px_80px_rgba(0,0,0,0.45)]',
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-[28px]',
        'before:border before:border-white/5 before:[mask-image:linear-gradient(to_bottom,white,transparent)]',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function MetricRow({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-[rgba(212,175,55,0.95)] shadow-[0_0_18px_rgba(212,175,55,0.55)]" />
        <span className="text-sm font-medium text-white/72">{label}</span>
      </div>

      <div className="text-right">
        <div className="text-sm font-semibold tracking-wide text-white">{value}</div>
        {delta ? <div className="text-[11px] text-emerald-300/80">{delta}</div> : null}
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.10),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(0,229,255,0.08),transparent_20%),linear-gradient(180deg,#050505_0%,#080808_45%,#0A0A0A_100%)]" />

      {/* Noise / grid wash */}
      <div className="absolute inset-0 -z-10 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px]" />

      {/* Main gold glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-[22%] -z-10 h-[720px] w-[720px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0.07) 42%, transparent 72%)',
        }}
      />

      {/* Lower cyan glow */}
      <div
        className="pointer-events-none absolute right-[8%] bottom-[10%] -z-10 h-[340px] w-[340px] rounded-full opacity-20 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(0,229,255,0.18) 0%, rgba(0,229,255,0.04) 46%, transparent 72%)',
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="mx-auto grid min-h-[calc(100dvh-7rem)] max-w-7xl grid-cols-1 items-center gap-8 px-6 py-10 md:gap-14 md:px-8 md:py-16 lg:grid-cols-12 lg:gap-10 lg:px-10 xl:px-12"
      >
        {/* LEFT SIDE */}
        <div className="lg:col-span-5">
          <motion.div variants={fadeLeft} className="mb-5 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-sm">
            <KoyaMark size={20} id="hero-badge" />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
              Borderless financial operating system
            </span>
          </motion.div>

          <motion.h1
            variants={fadeLeft}
            className="max-w-2xl font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-white sm:text-5xl md:text-6xl xl:text-7xl"
          >
            Move money across
            <span className="block text-gold">
              currencies like
            </span>
            one controlled system.
          </motion.h1>

          <motion.p
            variants={fadeLeft}
            className="mt-6 max-w-xl text-base leading-7 text-white/64 md:text-lg"
          >
            Koya unifies wallets, conversion, cards, and global value rails into one premium
            interface. Hold, convert, send, spend, and manage KES, USD, BTC, and stablecoins
            without the usual financial circus.
          </motion.p>

          <motion.div
            variants={fadeLeft}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button size="lg" className="group">
              Get Early Access
              <ChevronRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Button>

            <Button variant="outline" size="lg" className="border-white/12 bg-white/[0.02] text-white hover:bg-white/[0.06]">
              See How It Works
            </Button>
          </motion.div>

          <motion.div
            variants={fadeLeft}
            className="mt-8 flex flex-wrap items-center gap-2"
          >
            {currencies.map((c) => (
              <span
                key={c}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-medium tracking-[0.14em] text-white/62 uppercase"
              >
                {c}
              </span>
            ))}
          </motion.div>

          <motion.div
            variants={fadeLeft}
            className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-white/80">
                <ArrowRightLeft className="h-4 w-4 text-[rgba(212,175,55,0.95)]" />
                <span className="text-sm font-medium">Instant conversion</span>
              </div>
              <p className="text-xs leading-5 text-white/52">
                Switch value across wallets without breaking flow.
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-white/80">
                <CreditCard className="h-4 w-4 text-[rgba(212,175,55,0.95)]" />
                <span className="text-sm font-medium">Cards + spending</span>
              </div>
              <p className="text-xs leading-5 text-white/52">
                Fund cards and control spend from the same stack.
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-white/80">
                <ShieldCheck className="h-4 w-4 text-[rgba(212,175,55,0.95)]" />
                <span className="text-sm font-medium">Secure rails</span>
              </div>
              <p className="text-xs leading-5 text-white/52">
                Premium controls, settlement clarity, and safer movement.
              </p>
            </div>
          </motion.div>
        </div>

        {/* RIGHT SIDE */}
        <motion.div
          variants={fadeRight}
          className="relative lg:col-span-7"
        >
          <div className="relative mx-auto h-[620px] w-full max-w-[760px]">
            {/* ambient ring */}
            <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(212,175,55,0.12)] opacity-70" />
            <div className="absolute left-1/2 top-1/2 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5 opacity-40" />

            {/* Main dashboard card */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-1/2 top-1/2 z-20 w-[92%] max-w-[560px] -translate-x-1/2 -translate-y-1/2"
            >
              <div className="relative rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.58)] backdrop-blur-md">
                <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(212,175,55,0.10),transparent_25%)]" />

                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Total portfolio
                      </div>
                      <div className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                        $24,860.42
                      </div>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                        <TrendingUp className="h-3.5 w-3.5" />
                        +4.82% in the last 24h
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-right">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">
                        Status
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-2 text-sm font-medium text-white/78">
                        <span className="h-2 w-2 rounded-full bg-[rgba(212,175,55,0.95)] shadow-[0_0_18px_rgba(212,175,55,0.55)]" />
                        Settlement synced
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    <MetricRow label="KES Wallet" value="KES 124,560" delta="+1.8%" />
                    <MetricRow label="USD Wallet" value="$820.10" delta="+0.6%" />
                    <MetricRow label="BTC Wallet" value="0.0184 BTC" delta="+3.2%" />
                    <MetricRow label="USDC Wallet" value="2,400 USDC" delta="+0.1%" />
                  </div>

                  <div className="mt-5 grid grid-cols-4 gap-2">
                    {[
                      { label: 'Convert', icon: ArrowRightLeft },
                      { label: 'Deposit', icon: Wallet },
                      { label: 'Card', icon: CreditCard },
                      { label: 'Rewards', icon: Sparkles },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3 text-left transition-all duration-300 hover:bg-white/[0.07]"
                        >
                          <Icon className="mb-2 h-4 w-4 text-[rgba(212,175,55,0.95)]" />
                          <div className="text-xs font-medium text-white/74">{item.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Conversion card */}
            <motion.div
              variants={floatSoft}
              animate="animate"
              className="absolute left-[2%] top-[10%] z-30 hidden w-[260px] md:block"
            >
              <GlassCard className="relative p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                      Live conversion
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">KES → BTC</div>
                  </div>
                  <div className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2 py-1 text-[10px] font-medium text-cyan-300">
                    Quote locked
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-white/38">From</div>
                    <div className="mt-1 flex items-center justify-between text-sm text-white">
                      <span>KES</span>
                      <span>35,000</span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="rounded-full border border-white/8 bg-white/[0.04] p-2">
                      <ArrowRightLeft className="h-4 w-4 text-[rgba(212,175,55,0.95)]" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-white/38">To</div>
                    <div className="mt-1 flex items-center justify-between text-sm text-white">
                      <span>BTC</span>
                      <span>0.00482</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-white/48">
                  <span>Rate 1 BTC = KES 7,261,410</span>
                  <span>27s</span>
                </div>
              </GlassCard>
            </motion.div>

            {/* Premium card */}
            <motion.div
              animate={{
                y: [0, -10, 0],
                rotate: [-5, -3.8, -5],
              }}
              transition={{
                duration: 9,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute right-[1%] top-[14%] z-30 w-[290px]"
            >
              <div className="relative overflow-hidden rounded-[28px] border border-[rgba(212,175,55,0.24)] bg-[linear-gradient(135deg,#0A0A0A_0%,#111111_45%,#171717_100%)] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(240,208,96,0.20),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(212,175,55,0.18),transparent_30%)]" />
                <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.08)_48%,transparent_74%)]" />

                <div className="relative flex h-[168px] flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <KoyaMark size={20} id="hero-card" />
                    <div className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/55">
                      Virtual
                    </div>
                  </div>

                  <div>
                    <div className="font-mono text-lg tracking-[0.28em] text-white/88">
                      •••• •••• •••• 4021
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-white/42">
                          Funded by
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <KesIcon size={20} />
                          <UsdIcon size={20} />
                          <BtcIcon size={20} />
                          <UsdcIcon size={20} />
                        </div>
                      </div>

                      <MastercardLogo className="h-8 w-auto" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Activity chip */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              className="absolute bottom-[12%] left-[6%] z-30 hidden w-[220px] md:block"
            >
              <GlassCard className="relative p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                  Activity
                </div>
                <div className="mt-2 text-sm font-medium text-white/86">
                  M-Pesa deposit successful
                </div>
                <div className="mt-1 text-xs text-white/48">
                  KES 18,500 settled to primary wallet
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/6">
                  <div className="h-full w-[78%] rounded-full bg-[linear-gradient(90deg,#D4AF37_0%,#F0D060_100%)]" />
                </div>
              </GlassCard>
            </motion.div>

            {/* Yield / markets chip */}
            <motion.div
              animate={{ y: [0, -8, 0], x: [0, 2, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              className="absolute bottom-[6%] right-[4%] z-30 w-[240px]"
            >
              <GlassCard className="relative p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                    Markets & yield
                  </div>
                  <TrendingUp className="h-4 w-4 text-emerald-300/80" />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-white/78">
                    <span>BTC</span>
                    <span className="text-emerald-300">+3.2%</span>
                  </div>
                  <div className="flex items-center justify-between text-white/78">
                    <span>USDC Yield</span>
                    <span className="text-white/90">5.1% APY</span>
                  </div>
                  <div className="flex items-center justify-between text-white/78">
                    <span>USD Cash</span>
                    <span className="text-white/90">$820.10</span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}