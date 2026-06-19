import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Money } from "@/components/shared/Money";
import { useData } from "@/data/DataProvider";
import { formatGBP, formatPct, titleCase } from "@/lib/utils";
import type { Debt } from "@/types/domain";

function payoffSchedule(debt: Debt, maxMonths = 120) {
  const points: Array<{ month: number; balance: number }> = [];
  let balance = debt.current_balance;
  const monthlyRate = (debt.apr ?? 0) / 100 / 12;
  const payment = debt.minimum_payment ?? balance / 12;
  points.push({ month: 0, balance: Math.round(balance) });
  for (let m = 1; m <= maxMonths && balance > 0; m++) {
    balance = balance + balance * monthlyRate - payment;
    if (balance < 0) balance = 0;
    points.push({ month: m, balance: Math.round(balance) });
    if (balance === 0) break;
  }
  return points;
}

export function DebtsPage() {
  const { data, accountById } = useData();
  const debts = data.debts;
  const [selectedId, setSelectedId] = useState<string>(debts[0]?.id ?? "");

  const totals = useMemo(() => {
    const active = debts.filter((d) => d.status === "active");
    const total = active.reduce((s, d) => s + d.current_balance, 0);
    const minPay = active.reduce((s, d) => s + (d.minimum_payment ?? 0), 0);
    const weightedApr =
      total > 0
        ? active.reduce((s, d) => s + (d.apr ?? 0) * d.current_balance, 0) / total
        : 0;
    return { total, minPay, weightedApr };
  }, [debts]);

  const selected = debts.find((d) => d.id === selectedId) ?? debts[0];
  const schedule = useMemo(
    () => (selected ? payoffSchedule(selected) : []),
    [selected],
  );
  const payoffMonths = schedule.length ? schedule[schedule.length - 1].month : 0;

  const payments = useMemo(
    () =>
      selected
        ? data.debtPayments
            .filter((p) => p.debt_id === selected.id)
            .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
        : [],
    [data.debtPayments, selected],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Debts"
        description="Balances, APR, minimum payments and payoff progress across cards, loans, car finance, BNPL and tax."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total debt" value={formatGBP(totals.total)} accent="destructive" />
        <StatCard label="Min payments/mo" value={formatGBP(totals.minPay)} accent="warning" />
        <StatCard label="Weighted APR" value={formatPct(totals.weightedApr, 1)} />
        <StatCard label="Active debts" value={String(debts.filter((d) => d.status === "active").length)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {debts.map((d) => {
          const paid = d.original_balance ? d.original_balance - d.current_balance : 0;
          const pct = d.original_balance ? (paid / d.original_balance) * 100 : 0;
          return (
            <Card key={d.id} className={selectedId === d.id ? "border-primary/50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.lender ?? "—"} · {titleCase(d.debt_type)}
                      {accountById(d.account_id) ? ` · ${accountById(d.account_id)!.name}` : ""}
                    </p>
                  </div>
                  <Badge variant={d.status === "active" ? "warning" : "success"}>{titleCase(d.status)}</Badge>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-semibold tnum text-destructive">{formatGBP(d.current_balance)}</p>
                    <p className="text-xs text-muted-foreground">
                      APR {formatPct(d.apr ?? 0, 1)} · Min {formatGBP(d.minimum_payment)}
                      {d.due_day ? ` · Due ${d.due_day}${ordinal(d.due_day)}` : ""}
                    </p>
                  </div>
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => setSelectedId(d.id)}
                  >
                    View payoff
                  </button>
                </div>
                {d.original_balance != null && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Paid {formatGBP(paid)}</span>
                      <span>{Math.round(pct)}% of {formatGBP(d.original_balance)}</span>
                    </div>
                    <Progress value={pct} indicatorClassName="bg-success" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selected && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Payoff timeline — {selected.name}</CardTitle>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {debts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              At {formatGBP(selected.minimum_payment)}/mo and {formatPct(selected.apr ?? 0, 1)} APR, this clears in{" "}
              <span className="font-medium text-foreground">
                {payoffMonths > 0 ? `${payoffMonths} months (~${Math.ceil(payoffMonths / 12)} yr)` : "—"}
              </span>
              .
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={schedule} margin={{ left: -8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}m`} />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatGBP(v, { compact: true })} />
                <RTooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatGBP(v)}
                  labelFormatter={(l) => `Month ${l}`}
                />
                <Line type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>

            {payments.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recent payments</p>
                <div className="space-y-1 text-sm">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between border-b py-1.5 last:border-0">
                      <span className="text-muted-foreground">{p.payment_date}</span>
                      <span className="text-xs text-muted-foreground">
                        Principal {formatGBP(p.principal_amount)} · Interest {formatGBP(p.interest_amount)}
                      </span>
                      <Money value={p.amount} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
