'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Lock, Scale, ShieldCheck, BadgeCheck } from 'lucide-react';
import type { MarketingSectionContent } from '@/components/marketing/section-content';

function AnimatedCounter({
  target,
  suffix = '',
  start,
}: {
  target: number;
  suffix?: string;
  start: boolean;
}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    const duration = 1400;
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [start, target]);

  return (
    <span className="font-mono tabular-nums">
      {value.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}

const stats = [
  { value: 30, suffix: 's', label: 'Quote responsiveness' },
  { value: 99, suffix: '%', label: 'Platform availability target' },
  { value: 24, suffix: '/7', label: 'Monitoring coverage' },
  { value: 256, suffix: '-bit', label: 'Encryption baseline' },
];

const controls = [
  { icon: ShieldCheck, label: 'Segregated operational controls' },
  { icon: Lock, label: 'Encrypted user and payment data' },
  { icon: Scale, label: 'KYC and compliance checks' },
  { icon: BadgeCheck, label: 'Auditable transaction trail' },
];

export function TrustStrip({ content }: { content?: MarketingSectionContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <section ref={ref} className="border-y border-white/10 bg-[#0e0e0e]">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{content?.badge || 'Trust Signals'}</p>
          <p className="text-xs text-white/56">
            {content?.subheading || 'Built for clear execution, secure custody, and accountable operations.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-lg border border-white/10 bg-[#131313] px-4 py-3 text-center"
            >
              <div className="text-2xl font-semibold tracking-tight text-white-95">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} start={inView} />
              </div>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/38">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {controls.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-2 rounded-md border border-white/10 bg-[#111111] px-3 py-2.5">
                <Icon className="h-4 w-4 text-gold" />
                <span className="text-xs text-white/62">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
