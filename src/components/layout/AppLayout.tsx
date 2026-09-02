import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { LogOut, Moon, RefreshCw, Settings, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Brand } from "@/components/shared/Brand";
import { IconWell } from "@/components/shared/IconWell";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { useTheme } from "@/components/theme-provider";
import { useData } from "@/data/DataProvider";
import { useAuth } from "@/data/auth";
import { COMPANY } from "@/lib/company";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, NAV_ITEMS } from "./nav";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { data } = useData();
  const openReview = data.reviewTasks.filter((t) => t.status === "open").length;
  const overdueInvoices = (data.invoices ?? []).filter((i) => {
    if (i.status === "void" || i.status === "paid" || i.status === "draft") return false;
    return Boolean(i.due_date && i.due_date < new Date().toISOString().slice(0, 10));
  }).length;
  const location = useLocation();
  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {group}
          </p>
          {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to) && item.to !== "/";
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-2 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
              >
                <IconWell icon={item.icon} size="sm" variant={isActive ? "primary" : "muted"} />
                <span className="flex-1">{item.label}</span>
                {item.to === "/review" && openReview > 0 && (
                  <Badge variant="warning" className="h-5 px-1.5 text-[10px]">
                    {openReview}
                  </Badge>
                )}
                {item.to === "/invoices" && overdueInvoices > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                    {overdueInvoices}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const { theme, toggleTheme } = useTheme();
  const { refresh, loading, data } = useData();
  const { email, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const current = NAV_ITEMS.find((i) =>
    i.end ? location.pathname === i.to : location.pathname.startsWith(i.to) && i.to !== "/",
  );
  const currentLabel =
    current?.label ?? (location.pathname.startsWith("/print") ? "Print" : "Dashboard");
  const openReview = data.reviewTasks.filter((t) => t.status === "open").length;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-dvh w-full bg-background lg:gap-3 lg:p-3">
        <aside className="sticky top-3 hidden h-[calc(100dvh-1.5rem)] w-[260px] shrink-0 flex-col rounded-[1.75rem] bg-card p-5 shadow-card lg:flex">
          <Brand />
          <div className="mt-8 flex-1 overflow-y-auto scrollbar-thin">
            <SidebarNav />
          </div>
          <div className="mt-4 rounded-3xl bg-secondary p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{data.profile?.full_name || COMPANY.tradingName}</p>
            <p className="truncate">{data.profile?.email ?? email ?? ""}</p>
            <p className="mt-1">No. {COMPANY.companyNumber}</p>
            <div className="mt-3 flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
                <Link to="/settings">
                  <Settings className="h-3.5 w-3.5" /> Settings
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => void signOut()}
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 bg-background/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:h-16 lg:px-4 lg:pt-0">
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetContent side="left" className="flex w-[min(272px,85vw)] flex-col border-0 p-5">
                <div className="mb-6">
                  <Brand />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
                  <SidebarNav onNavigate={() => setMoreOpen(false)} />
                </div>
                <Button
                  variant="ghost"
                  className="mt-4 h-11 justify-start"
                  onClick={() => {
                    setMoreOpen(false);
                    void signOut();
                  }}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </SheetContent>
            </Sheet>

            <div className="flex min-w-0 items-center gap-3">
              {current && (
                <IconWell icon={current.icon} variant="primary" size="sm" className="lg:hidden" />
              )}
              {current && (
                <IconWell
                  icon={current.icon}
                  variant="primary"
                  size="md"
                  className="hidden lg:inline-flex"
                />
              )}
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight lg:text-lg">
                  {currentLabel}
                </h1>
                <p className="hidden truncate text-xs text-muted-foreground lg:block">
                  {COMPANY.legalName}
                </p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-11 w-11 lg:h-10 lg:w-10"
                    onClick={() => void refresh()}
                    disabled={loading}
                  >
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh data</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-11 w-11 lg:h-10 lg:w-10"
                    onClick={toggleTheme}
                  >
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

          <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-2 lg:px-6 lg:pb-8">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileTabBar
        onMore={() => setMoreOpen(true)}
        moreOpen={moreOpen}
        reviewCount={openReview}
      />
    </TooltipProvider>
  );
}
