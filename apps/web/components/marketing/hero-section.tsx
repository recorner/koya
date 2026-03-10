'use client';

import { motion } from 'framer-motion';
import { KoyaMark } from '@/components/marketing/koya-mark';
import { Button } from '@/components/ui/button';

const currencies = ['KES', 'USD', 'BTC', 'USDC', 'USDT'];

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const pillReveal = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export function HeroSection() {
  return (
    <section className="relative flex min-h-[calc(100dvh-7rem)] items-center justify-center overflow-hidden">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -z-10 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20"
        style={{
          background:
            'radial-gradient(circle, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.04) 45%, transparent 70%)',
        }}
      />

      {/* Subtle secondary glow */}
      <div
        className="pointer-events-none absolute right-0 bottom-0 -z-10 h-[400px] w-[400px] rounded-full opacity-10"
        style={{
          background:
            'radial-gradient(circle, rgba(0,229,255,0.15) 0%, transparent 70%)',
        }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 py-20 text-center"
      >
        {/* Logo mark */}
        <motion.div variants={fadeUp}>
          <KoyaMark size={56} id="hero" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={fadeUp}
          className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
        >
          <span className="text-white-95">Your money.</span>
          <br />
          <span className="text-gradient-gold">Every currency.</span>
          <br />
          <span className="text-white-95">One system.</span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          variants={fadeUp}
          className="max-w-xl text-base leading-relaxed text-white-60 md:text-lg"
        >
          Koya is the financial operating system for Africa and beyond.
          Convert, hold, and move value across KES, USD, BTC, and stablecoins
          — instantly, securely, from anywhere.
        </motion.p>

        {/* Currency pills */}
        <motion.div
          variants={fadeUp}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {currencies.map((c, i) => (
            <motion.span
              key={c}
              variants={pillReveal}
              custom={i}
              className="rounded-full border border-white-10 bg-white-5 px-3.5 py-1 font-mono text-xs font-medium text-white-60"
            >
              {c}
            </motion.span>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button size="lg">Get Early Access</Button>
          <Button variant="outline" size="lg">
            See How It Works
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
