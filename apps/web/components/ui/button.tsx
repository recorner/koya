import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-semibold tracking-[-0.01em] transition-[transform,background-color,border-color,color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/45 focus-visible:ring-offset-2 focus-visible:ring-offset-vault-black active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          'border-gold/35 bg-[linear-gradient(180deg,#F0D060_0%,#D4AF37_56%,#A88520_100%)] text-vault-black shadow-[0_12px_30px_rgba(212,175,55,0.2),inset_0_1px_0_rgba(255,255,255,0.45)] hover:-translate-y-px hover:shadow-[0_18px_36px_rgba(212,175,55,0.24),inset_0_1px_0_rgba(255,255,255,0.5)]',
        destructive:
          'border-red/30 bg-red text-white shadow-[0_12px_30px_rgba(239,68,68,0.18)] hover:-translate-y-px hover:bg-red/90 hover:shadow-[0_16px_34px_rgba(239,68,68,0.24)]',
        outline:
          'border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(0,0,0,0.24)] hover:-translate-y-px hover:border-white/18 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.05))] hover:text-white-95 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_14px_32px_rgba(0,0,0,0.28)]',
        secondary:
          'border-white/8 bg-[linear-gradient(180deg,rgba(28,28,30,0.95),rgba(12,12,14,0.98))] text-white-95 shadow-[0_12px_28px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.04)] hover:-translate-y-px hover:border-white/12 hover:bg-[linear-gradient(180deg,rgba(38,38,40,0.98),rgba(14,14,16,1))]',
        ghost:
          'border-transparent bg-transparent text-white/78 hover:border-white/10 hover:bg-white/5 hover:text-white-95',
        link: 'text-gold underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-[14px] px-6 text-base',
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

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
