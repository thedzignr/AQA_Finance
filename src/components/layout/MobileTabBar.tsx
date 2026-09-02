import { NavLink } from "react-router-dom";
import { Camera, ClipboardCheck, LayoutDashboard, MoreHorizontal, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Money", icon: Receipt, end: false },
  { to: "/documents", label: "Capture", icon: Camera, end: false, capture: true },
  { to: "/review", label: "Review", icon: ClipboardCheck, end: false },
] as const;

export function MobileTabBar({
  onMore,
  moreOpen,
  reviewCount = 0,
}: {
  onMore: () => void;
  moreOpen: boolean;
  reviewCount?: number;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 no-print backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-[4.25rem] grid-cols-5 items-stretch">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.to} {...tab} />
        ))}
        <TabLink {...TABS[2]} />
        <TabLink {...TABS[3]} badge={reviewCount} />
        <button
          type="button"
          onClick={onMore}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
            moreOpen ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}

function TabLink({
  to,
  label,
  icon: Icon,
  end,
  capture,
  badge,
}: {
  to: string;
  label: string;
  icon: typeof Camera;
  end: boolean;
  capture?: boolean;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
          isActive ? "text-foreground" : "text-muted-foreground",
        )
      }
    >
      {({ isActive }) =>
        capture ? (
          <span className="flex flex-col items-center justify-end pb-1">
            <span
              className={cn(
                "-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-neon",
                isActive && "ring-2 ring-foreground/15",
              )}
            >
              <Icon className="h-6 w-6" />
            </span>
            <span className="mt-0.5">{label}</span>
          </span>
        ) : (
          <>
            <span className="relative">
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              {badge ? (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground shadow-neon-magenta">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </span>
            {label}
          </>
        )
      }
    </NavLink>
  );
}
