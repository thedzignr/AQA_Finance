import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "default",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  accent?: "default" | "success" | "destructive" | "warning" | "primary";
}) {
  const accentClass = {
    default: "text-foreground",
    success: "text-success",
    destructive: "text-destructive",
    warning: "text-warning",
    primary: "text-primary",
  }[accent];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {Icon && <Icon className={cn("h-4 w-4", accentClass)} />}
        </div>
        <p className={cn("mt-2 text-2xl font-semibold tnum", accentClass)}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
