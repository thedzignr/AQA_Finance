import { COMPANY } from "@/lib/company";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-black tracking-tight text-primary-foreground shadow-neon",
        className,
      )}
    >
      A
    </div>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold tracking-tight">{COMPANY.tradingName}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {COMPANY.shortLegal} · {COMPANY.companyNumber}
        </p>
      </div>
    </div>
  );
}
