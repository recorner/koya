import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-white-10 bg-transparent px-3 py-1 text-sm text-white-95 shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white-95 placeholder:text-white-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
