import { cn, formatGBP } from "@/lib/utils";

export function Money({
  value,
  className,
  signed,
  colored,
  compact,
}: {
  value: number | null | undefined;
  className?: string;
  signed?: boolean;
  colored?: boolean;
  compact?: boolean;
}) {
  const v = value ?? 0;
  const colorClass = colored
    ? v > 0
      ? "text-success"
      : v < 0
        ? "text-destructive"
        : "text-muted-foreground"
    : "";
  return (
    <span className={cn("tnum", colorClass, className)}>
      {formatGBP(v, { signed, compact })}
    </span>
  );
}
