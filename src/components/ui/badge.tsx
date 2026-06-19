import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
        muted: 'border-white/10 bg-white/5 text-slate-300',
        success: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
        warning: 'border-amber-300/30 bg-amber-400/10 text-amber-100',
        danger: 'border-rose-300/30 bg-rose-400/10 text-rose-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
