import { useMemo } from "react";
import { Briefcase, Layers, PiggyBank, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Money } from "@/components/shared/Money";
import { SectionTitle } from "@/components/shared/IconWell";
import { useData } from "@/data/DataProvider";
import {
  categorySpendForMonth,
  isInMonth,
  workStreamSummaries,
} from "@/lib/selectors";
import { clamp, formatGBP, monthKey } from "@/lib/utils";

const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

export function BudgetPage() {
  const { data, categoryById } = useData();
  const mk = monthKey();
  const budgets = data.budgets.filter((b) => b.month_key === mk);

  const rows = useMemo(
    () =>
      budgets.map((b) => {
        const actual = b.category_id ? categorySpendForMonth(data, b.category_id, mk) : 0;
        const pct = b.target_amount ? (actual / b.target_amount) * 100 : 0;
        return { budget: b, actual, pct, over: actual > b.target_amount };
      }),
    [budgets, data, mk],
  );

  const totalBudget = rows.reduce((s, r) => s + r.budget.target_amount, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  const ownershipSplit = useMemo(() => {
    let personal = 0;
    let business = 0;
    for (const t of data.transactions) {
      if (t.direction !== "outflow" || t.kind === "transfer") continue;
      if (!isInMonth(t.transaction_date, mk)) continue;
      if (t.ownership_type === "personal") personal += t.amount;
      else if (t.ownership_type === "business") business += t.amount;
      else {
        business += (t.amount * t.business_use_pct) / 100;
        personal += (t.amount * (100 - t.business_use_pct)) / 100;
      }
    }
    return { personal, business };
  }, [data.transactions, mk]);

  const wsProfit = useMemo(
    () => workStreamSummaries(data, (t) => isInMonth(t.transaction_date, mk)),
    [data, mk],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        icon={PiggyBank}
        description={`Planned vs actual spending for ${monthName.format(new Date())}, plus personal/business split and work-stream profitability.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Budgeted" value={formatGBP(totalBudget)} icon={PiggyBank} accent="primary" />
        <StatCard label="Spent" value={formatGBP(totalActual)} icon={TrendingDown} accent={totalActual > totalBudget ? "destructive" : "default"} />
        <StatCard label="Remaining" value={formatGBP(totalBudget - totalActual)} icon={Wallet} accent={totalBudget - totalActual < 0 ? "destructive" : "success"} />
        <StatCard label="Business spend" value={formatGBP(ownershipSplit.business)} icon={Briefcase} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionTitle icon={Layers}>Category budgets</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map((r) => (
              <div key={r.budget.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {categoryById(r.budget.category_id)?.name ?? "—"}
                    {r.budget.ownership_type && (
                      <Badge variant="muted" className="capitalize">{r.budget.ownership_type}</Badge>
                    )}
                  </span>
                  <span className={r.over ? "text-destructive" : "text-muted-foreground"}>
                    {formatGBP(r.actual)} / {formatGBP(r.budget.target_amount)}
                  </span>
                </div>
                <Progress
                  value={clamp(r.pct, 0, 100)}
                  indicatorClassName={r.over ? "bg-destructive" : r.pct > 80 ? "bg-warning" : "bg-primary"}
                />
              </div>
            ))}
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">No budgets set for this month.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle icon={Briefcase}>Personal vs business</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span>Personal</span>
                <Money value={ownershipSplit.personal} />
              </div>
              <Progress
                value={split(ownershipSplit.personal, ownershipSplit.business)}
                indicatorClassName="bg-primary"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span>Business (allowable)</span>
                <Money value={ownershipSplit.business} />
              </div>
              <Progress
                value={split(ownershipSplit.business, ownershipSplit.personal)}
                indicatorClassName="bg-success"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Mixed-use transactions are apportioned by business-use %.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <SectionTitle icon={PiggyBank}>Work-stream profitability (this month)</SectionTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work stream</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wsProfit.map((w) => (
                <TableRow key={w.workStream.id}>
                  <TableCell className="font-medium">{w.workStream.name}</TableCell>
                  <TableCell className="text-right"><Money value={w.income} /></TableCell>
                  <TableCell className="text-right"><Money value={w.expenses} /></TableCell>
                  <TableCell className="text-right"><Money value={w.net} colored signed /></TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {w.income > 0 ? `${Math.round((w.net / w.income) * 100)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function split(a: number, b: number): number {
  const total = a + b;
  return total > 0 ? (a / total) * 100 : 0;
}
