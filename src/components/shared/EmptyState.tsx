import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconWell } from "@/components/shared/IconWell";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[1.25rem] bg-card py-12 text-center shadow-card">
      <IconWell icon={icon} variant="accent" size="lg" />
      <div>
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
