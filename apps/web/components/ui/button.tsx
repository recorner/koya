import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-semibold tracking-[0.01em] transition-[transform,background-color,border-color,color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/45 focus-visible:ring-offset-2 focus-visible:ring-offset-vault-black active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          'border-gold/70 bg-gold text-vault-black shadow-[0_12px_34px_rgba(200,150,60,0.22)] hover:-translate-y-px hover:bg-gold-light hover:shadow-[0_18px_40px_rgba(200,150,60,0.3)]',
        destructive:
          'border-red/40 bg-red text-white shadow-[0_12px_30px_rgba(239,68,68,0.2)] hover:-translate-y-px hover:bg-red/90',
        outline:
          'border-white/18 bg-transparent text-white-95 hover:-translate-y-px hover:border-white/26 hover:bg-white/[0.04]',
        secondary:
          'border-white/14 bg-[#1a1a1a] text-white-95 shadow-[0_10px_26px_rgba(0,0,0,0.35)] hover:-translate-y-px hover:bg-[#202020]',
        ghost:
          'border-transparent bg-transparent text-white/72 hover:border-white/12 hover:bg-white/[0.04] hover:text-white-95',
        link: 'text-gold underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-11 px-6 text-sm',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
