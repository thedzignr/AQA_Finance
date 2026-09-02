import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CreditCard,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  NotebookPen,
  PiggyBank,
  Plus,
  Repeat,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/shared/StatCard";
import { IconWell, SectionTitle } from "@/components/shared/IconWell";
import { Money } from "@/components/shared/Money";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { WeeklyStatementUpload } from "@/components/dashboard/WeeklyStatementUpload";
import { InboundMailboxCard } from "@/components/shared/InboundMailboxCard";
import { useData } from "@/data/DataProvider";
import {
  dashboardSummary,
  estimateCorporationTax,
  estimateSelfEmployedTax,
  isLimitedCompany,
  monthlyCashFlowTrend,
  runningCosts,
  salesSummary,
  taxYearSummary,
  thisWeekWorkLog,
  companyProfile,
} from "@/lib/selectors";
import type { RunningCostGroup } from "@/lib/selectors";
import { allInsights } from "@/lib/insights";
import { COMPANY } from "@/lib/company";
import { EXPENSE_FILL, INCOME_FILL } from "@/lib/palette";
import { cn, formatGBP, monthKey } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

const COST_GROUPS: Array<{ key: RunningCostGroup; label: string }> = [
  { key: "bill", label: "Bills" },
  { key: "subscription", label: "Subscriptions" },
  { key: "debt", label: "Debt minimums" },
];
const COST_GROUP_LABEL: Record<RunningCostGroup, string> = {
  bill: "Bill",
  subscription: "Subscription",
  debt: "Debt minimum",
};
const COST_BAR: Record<RunningCostGroup, string> = {
  bill: "bg-chart-1",
  subscription: "bg-chart-2",
  debt: "bg-chart-3",
};

const CHART_TOOLTIP = {
  background: "hsl(var(--popover))",
  border: "none",
  borderRadius: 16,
  boxShadow: "var(--shadow-card)",
  fontSize: 12,
};

function MiniSpark({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-11 items-end gap-0.5">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-t-sm bg-chart-1/80", className)}
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { data, categoryById } = useData();
  const [addOpen, setAddOpen] = useState(false);

  const summary = useMemo(() => dashboardSummary(data), [data]);
  const tax = useMemo(() => taxYearSummary(data), [data]);
  const taxEst = useMemo(() => estimateSelfEmployedTax(tax.estimatedProfit), [tax]);
  const corpTax = useMemo(() => estimateCorporationTax(tax.estimatedProfit), [tax]);
  const ltd = useMemo(() => isLimitedCompany(data), [data]);
  const sales = useMemo(() => salesSummary(data), [data]);
  const week = useMemo(() => thisWeekWorkLog(data), [data]);
  const company = companyProfile(data);
  const flowTrend = useMemo(() => monthlyCashFlowTrend(data, 12), [data]);
  const insights = useMemo(() => allInsights(data), [data]);
  const costs = useMemo(() => runningCosts(data), [data]);
  const incomeSplit = useMemo(() => {
    const key = monthKey();
    return data.workStreams
      .map((ws) => ({
        name: ws.name,
        amount: data.transactions
          .filter(
            (t) =>
              t.work_stream_id === ws.id &&
              t.direction === "inflow" &&
              t.kind !== "transfer" &&
              t.transaction_date.slice(0, 7) === key,
          )
          .reduce((s, t) => s + t.amount, 0),
      }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [data]);

  const remaining = useMemo(() => {
    const used =
      costs.monthlyTotal > 0 ? summary.moneyOutThisMonth / costs.monthlyTotal : 0;
    const pct = Math.round(Math.max(0, Math.min(100, (1 - used) * 100)));
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(0, daysInMonth - now.getDate());
    return { pct, daysLeft, used };
  }, [costs.monthlyTotal, summary.moneyOutThisMonth]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="hidden items-center gap-3 md:flex">
            <IconWell icon={LayoutDashboard} variant="primary" size="lg" />
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Good to see you, {data.profile?.full_name?.split(" ")[0] ?? "there"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {COMPANY.legalName} · Company no. {company?.company_number || COMPANY.companyNumber}
              </p>
            </div>
          </div>
        <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-wrap">
          <Button variant="outline" asChild className="h-11 px-2 text-xs sm:text-sm lg:h-10 lg:px-5">
            <Link to="/work-log">
              <NotebookPen className="h-4 w-4" /> <span className="truncate">Log work</span>
            </Link>
          </Button>
          <Button variant="outline" asChild className="h-11 px-2 text-xs sm:text-sm lg:h-10 lg:px-5">
            <Link to="/invoices">
              <FileSpreadsheet className="h-4 w-4" /> <span className="truncate">Invoice</span>
            </Link>
          </Button>
          <Button onClick={() => setAddOpen(true)} className="h-11 px-2 text-xs sm:text-sm lg:h-10 lg:px-5">
            <Plus className="h-4 w-4" /> <span className="truncate">Add</span>
          </Button>
        </div>
      </div>

      {/* Hero metrics */}
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          size="lg"
          accent="primary"
          label="Total cash"
          value={formatGBP(summary.totalCash)}
          icon={Wallet}
          hint={`Net worth ${formatGBP(summary.netWorth)}`}
        />
        <Card className="shadow-neon-cyan">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Money in</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tnum sm:mt-3 sm:text-4xl">
                  {formatGBP(summary.moneyInThisMonth)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">This month</p>
              </div>
              <div className="hidden flex-col items-end gap-3 sm:flex">
                <IconWell icon={TrendingUp} variant="success" size="sm" />
                <div className="w-28">
                  <MiniSpark values={flowTrend.map((r) => r.income)} />
                </div>
              </div>
            </div>
            {incomeSplit.length > 0 && (
              <div className="mt-5 hidden grid-cols-3 gap-2 border-t pt-4 sm:grid">
                {incomeSplit.map((row) => (
                  <div key={row.name}>
                    <p className="truncate text-[11px] text-muted-foreground">{row.name}</p>
                    <p className="text-sm font-medium tnum">{formatGBP(row.amount, { compact: true })}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Money out</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight tnum sm:mt-3 sm:text-4xl">
                  {formatGBP(summary.moneyOutThisMonth)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Typical running costs {formatGBP(costs.monthlyTotal)}/mo
                </p>
              </div>
              <IconWell icon={TrendingDown} variant="destructive" size="sm" />
            </div>
            <Progress
              className="mt-5"
              value={
                costs.monthlyTotal > 0
                  ? Math.min(100, (summary.moneyOutThisMonth / costs.monthlyTotal) * 100)
                  : 0
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <SectionTitle icon={Repeat}>Money flow</SectionTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-1" /> Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-3" /> Expense
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowTrend} barGap={4} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => formatGBP(v, { compact: true })}
                />
                <RTooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={CHART_TOOLTIP}
                  formatter={(v: number) => formatGBP(v)}
                />
                <Bar dataKey="income" name="Income" fill={INCOME_FILL} radius={[8, 8, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" name="Expense" fill={EXPENSE_FILL} radius={[8, 8, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <SectionTitle icon={Gauge}>Remaining this month</SectionTitle>
            <Link to="/budget" className="text-xs text-muted-foreground hover:text-foreground">
              Budget
            </Link>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-semibold tracking-tight tnum">{remaining.pct}%</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {remaining.pct >= 40
                ? "Headroom against typical running costs."
                : remaining.used > 1
                  ? "Above typical running costs for this point in the month."
                  : "Most of this month’s typical costs are already spent."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{remaining.daysLeft} days left</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {COST_GROUPS.map(({ key, label }) => {
                const value = costs.byGroup[key];
                const pct = costs.monthlyTotal > 0 ? Math.round((value / costs.monthlyTotal) * 100) : 0;
                return (
                  <div
                    key={key}
                    className={cn(
                      "rounded-2xl p-3",
                      key === "bill" && "bg-chart-1 text-primary-foreground",
                      key === "subscription" && "bg-accent text-accent-foreground",
                      key === "debt" && "bg-chart-3 text-destructive-foreground",
                    )}
                  >
                    <p className="text-xl font-semibold tnum">{pct}%</p>
                    <p className="text-[11px] opacity-80">{label}</p>
                    <p className="text-[11px] opacity-80 tnum">{formatGBP(value, { compact: true })}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total debt" value={formatGBP(summary.debtTotal)} icon={CreditCard} accent="warning" />
        <StatCard
          label="Tax pot"
          value={formatGBP(summary.taxPotBalance)}
          icon={PiggyBank}
          hint={`Est. ${ltd ? "CT" : "tax"} ${formatGBP(ltd ? corpTax.tax : taxEst.total, { compact: true })}`}
        />
        <StatCard
          label="Outstanding invoices"
          value={formatGBP(sales.outstanding)}
          icon={FileSpreadsheet}
          hint={sales.overdueCount ? `${sales.overdueCount} overdue` : "None overdue"}
          accent={sales.overdue > 0 ? "destructive" : "primary"}
        />
        <StatCard
          label="This week"
          value={`${week.hours}h`}
          hint={week.unbilled > 0 ? `${formatGBP(week.unbilled)} unbilled` : `${formatGBP(week.amount)} logged`}
          icon={NotebookPen}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <SectionTitle icon={Banknote}>Work streams</SectionTitle>
            <Link to="/work-streams" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.workStreamSummary
              .filter((w) => w.transactionCount > 0)
              .sort((a, b) => b.net - a.net)
              .map((w) => (
                <div key={w.workStream.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{w.workStream.name}</span>
                    <Money value={w.net} colored signed />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>In {formatGBP(w.income)}</span>
                    <span>Out {formatGBP(w.expenses)}</span>
                  </div>
                </div>
              ))}
            {summary.workStreamSummary.filter((w) => w.transactionCount > 0).length === 0 && (
              <p className="text-sm text-muted-foreground">No work-stream activity yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <SectionTitle icon={FileSpreadsheet}>Sales this month</SectionTitle>
            <Link to="/invoices" className="text-xs text-primary hover:underline">
              Invoices
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-medium tnum">{formatGBP(sales.paidThisMonth)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overdue</span>
              <span className="font-medium tnum">{formatGBP(sales.overdue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Outstanding</span>
              <span className="font-medium tnum">{formatGBP(sales.outstanding)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Running costs */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
            <SectionTitle icon={Repeat}>Running costs</SectionTitle>
          <div className="text-right">
            <p className="text-2xl font-semibold tnum">{formatGBP(costs.monthlyTotal)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            <p className="text-xs text-muted-foreground">{formatGBP(costs.yearlyTotal)}/yr</p>
          </div>
        </CardHeader>
        <CardContent>
          {costs.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recurring costs tracked yet.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Breakdown by group */}
              <div className="space-y-3">
                {COST_GROUPS.map(({ key, label }) => {
                  const value = costs.byGroup[key];
                  const pct = costs.monthlyTotal > 0 ? (value / costs.monthlyTotal) * 100 : 0;
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{label}</span>
                        <span className="text-muted-foreground">
                          {formatGBP(value)}/mo · {Math.round(pct)}%
                        </span>
                      </div>
                      <Progress value={pct} indicatorClassName={COST_BAR[key]} />
                    </div>
                  );
                })}
              </div>

              {/* Largest recurring items */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Largest recurring items
                </p>
                <div className="space-y-1">
                  {costs.items.slice(0, 6).map((item) => (
                    <div key={`${item.group}-${item.id}`} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {COST_GROUP_LABEL[item.group]} · {item.cadence}
                          {item.cadence !== "Monthly" ? ` · ${formatGBP(item.rawAmount)} each` : ""}
                        </p>
                      </div>
                      <span className="tnum">{formatGBP(item.monthly)}/mo</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {/* PHV weekly statement quick upload */}
        <WeeklyStatementUpload />

        <InboundMailboxCard compact />

        {/* Upcoming bills */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <SectionTitle icon={CalendarClock}>Upcoming bills</SectionTitle>
            <Link to="/bills" className="text-xs text-primary hover:underline">
              All bills
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.upcomingBills.slice(0, 5).map((b) => (
              <div key={b.bill.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{b.bill.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateFmt.format(new Date(b.dueDate))}
                  </p>
                </div>
                <Money value={b.amount} />
              </div>
            ))}
            {summary.upcomingBills.length === 0 && (
              <p className="text-sm text-muted-foreground">No bills due soon.</p>
            )}
          </CardContent>
        </Card>

        {/* Savings goals */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <SectionTitle icon={PiggyBank}>Savings goals</SectionTitle>
            <Link to="/budget" className="text-xs text-primary hover:underline">
              Manage
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.savingsGoals.map((g) => {
              const pct = g.target_amount
                ? Math.min(100, (g.current_amount / g.target_amount) * 100)
                : 0;
              return (
                <div key={g.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatGBP(g.current_amount)} / {formatGBP(g.target_amount)}
                    </span>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Needs review / insights */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <SectionTitle icon={AlertTriangle} variant="warning">Needs attention</SectionTitle>
            <Link to="/review" className="text-xs text-primary hover:underline">
              Review queue
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between rounded-md bg-warning/10 px-3 py-2 text-sm">
              <span>Items needing review</span>
              <Badge variant="warning">{summary.reviewItems}</Badge>
            </div>
            {insights.slice(0, 4).map((i) => (
              <div key={i.id} className="rounded-md border p-2 text-xs">
                <p className="font-medium">{i.title}</p>
                <p className="text-muted-foreground">{i.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <SectionTitle icon={ArrowLeftRight}>Recent activity</SectionTitle>
          <Link
            to="/transactions"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View ledger <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-1">
          {summary.recentTransactions.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"
            >
              <IconWell
                icon={t.direction === "inflow" ? ArrowDownLeft : ArrowUpRight}
                size="sm"
                variant={t.direction === "inflow" ? "success" : "destructive"}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  {dateFmt.format(new Date(t.transaction_date))} ·{" "}
                  {categoryById(t.category_id)?.name ?? "Uncategorised"}
                </p>
              </div>
              <Money
                value={t.direction === "inflow" ? t.amount : -t.amount}
                colored
                signed
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <TransactionDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
