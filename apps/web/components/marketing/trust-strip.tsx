'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  Activity,
  Scale,
  Fingerprint,
} from 'lucide-react';

/* ── Animated counter ─────────────────────────────────────────── */

function AnimatedCounter({
  target,
  suffix = '',
  prefix = '',
  duration = 2000,
  start,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  start: boolean;
}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [start, target, duration]);

  return (
    <span className="font-mono tabular-nums">
      {prefix}{value.toLocaleString('en-US')}{suffix}
    </span>
  );
}

/* ── Trust signals ────────────────────────────────────────────── */

const signals = [
  { icon: ShieldCheck, label: 'Kenya-based & regulated' },
  { icon: Lock, label: 'End-to-end encrypted' },
  { icon: Activity, label: '24/7 monitoring' },
  { icon: Scale, label: 'KYC compliant' },
  { icon: Fingerprint, label: 'Fraud-protected' },
];

const stats = [
  { value: 5, suffix: '', label: 'Currencies supported' },
  { value: 99, suffix: '%', label: 'Uptime SLA' },
  { value: 30, suffix: 's', label: 'Avg. settlement' },
  { value: 256, suffix: '-bit', label: 'Encryption standard' },
];

/* ── Component ────────────────────────────────────────────────── */

export function TrustStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <section
      ref={ref}
      className="relative border-y border-white/[0.06] bg-[linear-gradient(180deg,#090909_0%,#0B0B0C_100%)]"
    >
      {/* Subtle gold line accent at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_15%,rgba(212,175,55,0.18)_50%,transparent_85%)]" />

      <div className="mx-auto max-w-7xl px-6 py-8 md:py-10">
        {/* Stats row — animated counters */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:mb-8 md:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 14 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeOut' }}
              className="text-center"
            >
              <div className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                <AnimatedCounter
                  target={stat.value}
                  suffix={stat.suffix}
                  start={isInView}
                  duration={1800 + i * 200}
                />
              </div>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/36">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-white/[0.06]" />

        {/* Trust signals — horizontal strip */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 md:mt-8 md:gap-x-10">
          {signals.map((signal, i) => {
            const Icon = signal.icon;
            return (
              <motion.div
                key={signal.label}
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                className="flex items-center gap-2"
              >
                <Icon
                  size={14}
                  strokeWidth={1.8}
                  className="text-gold/80"
                />
                <span className="text-xs font-medium text-white/48">
                  {signal.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}