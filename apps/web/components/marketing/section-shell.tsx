'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

const bgVariants = {
  default: 'bg-vault-black',
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
  const y = useTransform(scrollYProgress, [0, 1], [8, -8]);

  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 520px' }}
      className={cn(bgVariants[bg], !noPadding && 'py-18 md:py-24', className)}
    >
      <motion.div style={{ y }} className={cn('mx-auto max-w-7xl px-6 lg:px-10', noPadding && 'px-0')}>
        {children}
      </motion.div>
    </motion.section>
  );
}
