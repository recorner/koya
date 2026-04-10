'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

/* ── Basic fade-up ─────────────────────────────────────────────── */

export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/* ── Stagger group ─────────────────────────────────────────────── */

export function StaggerContainer({
  children,
  className,
  stagger = 0.1,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/* ── Scroll-linked parallax drift ──────────────────────────────
   Wraps children in a container that drifts upward slightly faster
   than the natural scroll, creating a subtle premium parallax feel.
   `intensity` controls how many px of extra movement (default 40).
   ─────────────────────────────────────────────────────────────── */

export function ParallaxDrift({
  children,
  className,
  intensity = 40,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [intensity, -intensity]);

  return (
    <div ref={ref} className={cn('overflow-visible', className)}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}

/* ── Float — continuous gentle floating animation ─────────────── */

export function Float({
  children,
  className,
  amplitude = 8,
  duration = 6,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  amplitude?: number;
  duration?: number;
  delay?: number;
}) {
  return (
    <motion.div
      animate={{
        y: [0, -amplitude, 0],
        rotate: [0, 0.4, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/* ── ScaleReveal — entrance that scales from slightly small ───── */

export function ScaleReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.32, 0.72, 0, 1] }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/* ── GlowPulse — subtle pulsing glow effect ───────────────────── */

export function GlowPulse({
  className,
  color = 'rgba(212,175,55,0.15)',
}: {
  className?: string;
  color?: string;
}) {
  return (
    <motion.div
      className={cn('pointer-events-none absolute rounded-full blur-3xl', className)}
      style={{ background: `radial-gradient(circle, ${color} 0%, transparent 72%)` }}
      animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.95, 1.05, 0.95] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
