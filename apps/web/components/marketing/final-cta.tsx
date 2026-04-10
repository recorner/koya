'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { KoyaMark } from '@/components/marketing/koya-mark';
import { ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react';
import { GlowPulse } from '@/components/marketing/motion-wrapper';

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#070707_0%,#050505_100%)] py-24 md:py-32">
      {/* ambient background — breathing */}
      <div className="pointer-events-none absolute inset-0">
        <GlowPulse className="left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2" />
        <GlowPulse className="right-[8%] bottom-[10%] h-[220px] w-[220px]" color="rgba(0,229,255,0.10)" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="relative z-10 mx-auto max-w-5xl px-6"
      >
        <div className="overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-10 md:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            {/* left */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/8 bg-white/[0.04] px-4 py-2">
                <KoyaMark size={20} id="final-cta" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/52">
                  Early access
                </span>
              </div>

              <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                Ready to take control
                <span className="block bg-[linear-gradient(180deg,#F0D060_0%,#D4AF37_48%,#A88520_100%)] bg-clip-text text-transparent">
                  of your money?
                </span>
              </h2>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
                Join the waitlist for early access to Koya — deposit via M-Pesa,
                hold multiple currencies, buy Bitcoin, invest globally, and
                spend with a premium card. All from one account.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {['KES', 'USD', 'BTC', 'USDC', 'USDT'].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/58"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* right */}
            <div className="lg:col-span-5">
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[rgba(212,175,55,0.90)]" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
                    Join the list
                  </p>
                </div>

                <div className="space-y-3">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none placeholder:text-white/30 transition-all duration-200 focus:border-[rgba(212,175,55,0.35)] focus:bg-white/[0.05] focus:ring-1 focus:ring-[rgba(212,175,55,0.35)]"
                  />

                  <Button size="lg" className="group h-12 w-full">
                    Join Waitlist
                    <ArrowUpRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Button>
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-[rgba(212,175,55,0.85)]" />
                    <p className="text-xs leading-6 text-white/46">
                      No spam. Early members get priority access, product updates,
                      and first visibility into rollout waves.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}