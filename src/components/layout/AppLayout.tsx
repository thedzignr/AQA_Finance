import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Menu,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";
import { useData } from "@/data/DataProvider";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, NAV_ITEMS } from "./nav";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useData();
  const openReview = data.reviewTasks.filter((t) => t.status === "open").length;
  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {group}
          </p>
          {NAV_ITEMS.filter((i) => i.group === group).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.to === "/review" && openReview > 0 && (
                <Badge variant="warning" className="h-5 px-1.5 text-[10px]">
                  {openReview}
                </Badge>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <TrendingUp className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">AQA Finance</p>
        <p className="text-[11px] text-muted-foreground">UK money management</p>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { theme, toggleTheme } = useTheme();
  const { backend, refresh, reset, loading, data } = useData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const currentLabel =
    NAV_ITEMS.find((i) =>
      i.end ? location.pathname === i.to : location.pathname.startsWith(i.to) && i.to !== "/",
    )?.label ?? "Dashboard";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen w-full bg-background">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/40 p-4 lg:flex">
          <Brand />
          <div className="mt-7 flex-1 overflow-y-auto scrollbar-thin">
            <NavList />
          </div>
          <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{data.profile?.full_name ?? "Demo user"}</p>
            <p className="truncate">{data.profile?.email ?? ""}</p>
            <Badge variant={backend === "supabase" ? "success" : "muted"} className="mt-2">
              {backend === "supabase" ? "Supabase" : "Local demo data"}
            </Badge>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <div className="mb-6">
                  <Brand />
                </div>
                <NavList onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <h1 className="text-base font-semibold">{currentLabel}</h1>

            <div className="ml-auto flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void refresh()}
                    disabled={loading}
                  >
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh data</TooltipContent>
              </Tooltip>
              {backend === "mock" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => void reset()}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset demo data</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleTheme}>
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle theme</TooltipContent>
              </Tooltip>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
