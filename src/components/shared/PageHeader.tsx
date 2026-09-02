import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconWell } from "@/components/shared/IconWell";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between",
        !actions && "max-lg:hidden",
      )}
    >
      <div className="hidden items-start gap-3 lg:flex">
        {icon && <IconWell icon={icon} variant="accent" size="lg" />}
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>
      )}
    </div>
  );
}
