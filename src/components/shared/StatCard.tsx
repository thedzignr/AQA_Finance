import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { IconWell, type IconWellVariant } from "@/components/shared/IconWell";
import { cn } from "@/lib/utils";

const ACCENT_WELL: Record<
  "default" | "success" | "destructive" | "warning" | "primary",
  IconWellVariant
> = {
  default: "accent",
  primary: "primary",
  success: "success",
  destructive: "destructive",
  warning: "warning",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "default",
  size = "md",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  accent?: "default" | "success" | "destructive" | "warning" | "primary";
  size?: "md" | "lg";
}) {
  const accentClass = {
    default: "text-foreground",
    success: "text-success",
    destructive: "text-destructive",
    warning: "text-warning",
    primary: "text-foreground",
  }[accent];

  return (
    <Card className={accent === "primary" ? "shadow-neon" : undefined}>
      <CardContent className={size === "lg" ? "p-4 sm:p-6" : "p-4 sm:p-5"}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          {Icon && <IconWell icon={Icon} size="sm" variant={ACCENT_WELL[accent]} />}
        </div>
        <p
          className={cn(
            "mt-2 font-semibold tracking-tight tnum sm:mt-3",
            size === "lg" ? "text-2xl sm:text-4xl" : "text-xl sm:text-2xl",
            accentClass,
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2">{hint}</p>}
      </CardContent>
    </Card>
  );
}
