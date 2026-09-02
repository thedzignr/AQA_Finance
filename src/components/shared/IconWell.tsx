import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-11 w-11",
} as const;

const ICON_SIZE = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

const VARIANT = {
  muted: "bg-secondary text-muted-foreground",
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  inverse: "bg-foreground text-background",
} as const;

export type IconWellVariant = keyof typeof VARIANT;
export type IconWellSize = keyof typeof SIZE;

export function IconWell({
  icon: Icon,
  variant = "muted",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  variant?: IconWellVariant;
  size?: IconWellSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        SIZE[size],
        VARIANT[variant],
        variant === "primary" && "shadow-neon",
        variant === "accent" && size !== "sm" && "shadow-neon-cyan",
        className,
      )}
    >
      <Icon className={ICON_SIZE[size]} />
    </span>
  );
}

export function SectionTitle({
  icon,
  children,
  variant = "accent",
  className,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  variant?: IconWellVariant;
  className?: string;
}) {
  return (
    <CardTitle className={cn("flex items-center gap-2.5", className)}>
      {icon && <IconWell icon={icon} size="sm" variant={variant} />}
      {children}
    </CardTitle>
  );
}
