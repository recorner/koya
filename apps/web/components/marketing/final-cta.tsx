'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { KoyaMark } from '@/components/marketing/koya-mark';

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-navy py-24 md:py-32">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -z-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15"
        style={{
          background:
            'radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 65%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 text-center"
      >
        <KoyaMark size={44} id="cta" />

        <h2 className="font-display text-3xl font-extrabold text-white-95 sm:text-4xl md:text-5xl">
          Ready to move{' '}
          <span className="text-gradient-gold">beyond borders?</span>
        </h2>

        <p className="max-w-md text-base leading-relaxed text-white-40">
          Join the waitlist for early access to Koya — the financial operating
          system for Africa and beyond.
        </p>

        <div className="mt-2 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
          <input
            type="email"
            placeholder="Enter your email"
            className="h-11 flex-1 rounded-lg border border-white-10 bg-transparent px-4 text-sm text-white-95 placeholder:text-white-40 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
          <Button size="lg" className="shrink-0">
            Join Waitlist
          </Button>
        </div>

        <p className="text-xs text-white-20">
          No spam. Early members get priority access.
        </p>
      </motion.div>
    </section>
  );
}
