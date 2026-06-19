import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CreditCard,
  PiggyBank,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/shared/StatCard";
import { Money } from "@/components/shared/Money";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { useData } from "@/data/DataProvider";
import {
  dashboardSummary,
  estimateSelfEmployedTax,
  taxYearSummary,
  workStreamMonthlyTrend,
} from "@/lib/selectors";
import { allInsights } from "@/lib/insights";
import { formatGBP } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function DashboardPage() {
  const { data, categoryById } = useData();
  const [addOpen, setAddOpen] = useState(false);

  const summary = useMemo(() => dashboardSummary(data), [data]);
  const tax = useMemo(() => taxYearSummary(data), [data]);
  const taxEst = useMemo(() => estimateSelfEmployedTax(tax.estimatedProfit), [tax]);
  const trend = useMemo(() => workStreamMonthlyTrend(data, 6), [data]);
  const insights = useMemo(() => allInsights(data), [data]);

  const trendData = trend.map((row) => ({
    month: String(row.month).slice(5),
    net:
      Object.entries(row)
        .filter(([k]) => k !== "month")
        .reduce((s, [, v]) => s + (v as number), 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Good to see you, {data.profile?.full_name?.split(" ")[0] ?? "there"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Here’s how your money looks today.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add transaction
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total cash" value={formatGBP(summary.totalCash)} icon={Wallet} accent="primary" />
        <StatCard label="Money in (mo)" value={formatGBP(summary.moneyInThisMonth)} icon={TrendingUp} accent="success" />
        <StatCard label="Money out (mo)" value={formatGBP(summary.moneyOutThisMonth)} icon={TrendingDown} accent="destructive" />
        <StatCard label="Total debt" value={formatGBP(summary.debtTotal)} icon={CreditCard} accent="warning" />
        <StatCard label="Tax pot" value={formatGBP(summary.taxPotBalance)} icon={PiggyBank} hint={`Est. tax ${formatGBP(taxEst.total, { compact: true })}`} />
        <StatCard label="Net worth" value={formatGBP(summary.netWorth)} icon={Banknote} accent={summary.netWorth >= 0 ? "success" : "destructive"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Net cashflow chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Net cashflow (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{ left: -16, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatGBP(v, { compact: true })} />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatGBP(v)}
                />
                <Area type="monotone" dataKey="net" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#netFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Work stream income */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Work streams</CardTitle>
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
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming bills */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Upcoming bills
            </CardTitle>
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
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4" /> Savings goals
            </CardTitle>
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
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Needs attention
            </CardTitle>
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
          <CardTitle>Recent activity</CardTitle>
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
              className="flex items-center justify-between border-b py-2 text-sm last:border-0"
            >
              <div className="min-w-0">
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
