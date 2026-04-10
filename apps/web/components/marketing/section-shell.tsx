'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

const bgVariants = {
  default: '',
  surface: 'bg-surface',
  cell: 'bg-cell',
  navy: 'bg-navy',
} as const;

export function SectionShell({
  children,
  id,
  bg = 'default',
  className,
  noPadding = false,
}: {
  children: React.ReactNode;
  id?: string;
  bg?: keyof typeof bgVariants;
  className?: string;
  noPadding?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  // Subtle parallax — inner content drifts 20px over the scroll range
  const y = useTransform(scrollYProgress, [0, 1], [20, -20]);

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 600px' }}
      className={cn(
        bgVariants[bg],
        !noPadding && 'py-20 md:py-28',
        className,
      )}
    >
      <motion.div
        style={{ y }}
        className={cn('mx-auto max-w-7xl px-6', noPadding && 'px-0')}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}
