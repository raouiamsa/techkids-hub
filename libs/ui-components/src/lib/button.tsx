import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1.5rem] text-xs font-black uppercase tracking-[0.15em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 active:scale-95 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-blue-500 text-slate-950 shadow-lg shadow-blue-500/20 hover:bg-blue-400',
        destructive:
          'bg-slate-800 text-white hover:bg-red-500/20 hover:text-red-400 border border-white/5',
        outline:
          'border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white',
        ghost:
          'text-slate-400 hover:bg-slate-800 hover:text-white',
        amber:
          'bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20',
        success:
          'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/20',
      },
      size: {
        default: 'h-11 px-8 py-3',
        sm: 'h-9 px-5 py-2 text-[10px]',
        lg: 'h-14 px-12 py-4',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
