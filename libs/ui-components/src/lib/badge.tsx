import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-wider transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-slate-800 text-slate-300 border border-slate-700',
        processing: 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm shadow-blue-500/10',
        pending: 'bg-amber-400/10 text-amber-400 border border-amber-400/20',
        approved: 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 shadow-sm shadow-emerald-500/10',
        rejected: 'bg-red-400/10 text-red-400 border border-red-400/20',
        outline: 'border border-slate-700 text-slate-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/**
 * Helper : retourne la variante adaptée au statut d'un brouillon
 */
export function getDraftStatusVariant(status: string): BadgeProps['variant'] {
  switch (status) {
    case 'PROCESSING': return 'processing';
    case 'PENDING_REVIEW': return 'pending';
    case 'APPROVED': return 'approved';
    case 'REJECTED': return 'rejected';
    default: return 'default';
  }
}

export { Badge, badgeVariants };
