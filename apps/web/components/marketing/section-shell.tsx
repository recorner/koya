'use client';

import { motion } from 'framer-motion';
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
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={cn(
        bgVariants[bg],
        !noPadding && 'py-20 md:py-28',
        className,
      )}
    >
      <div className={cn('mx-auto max-w-7xl px-6', noPadding && 'px-0')}>
        {children}
      </div>
    </motion.section>
  );
}
