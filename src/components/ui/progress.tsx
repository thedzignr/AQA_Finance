import { cn } from '../../lib/utils';

type ProgressProps = {
  value: number;
  className?: string;
};

export function Progress({ value, className }: ProgressProps) {
  const bounded = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-white/10', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300"
        style={{ width: `${bounded}%` }}
      />
    </div>
  );
}
