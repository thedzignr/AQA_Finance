import { useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { SectionTitle } from "@/components/shared/IconWell";
import { StatCard } from "@/components/shared/StatCard";
import { Money } from "@/components/shared/Money";
import { useData } from "@/data/DataProvider";
import { formatGBP, formatPct, titleCase, todayISO } from "@/lib/utils";
import type { Debt } from "@/types/domain";

// ----------------------------------------------------------------------------
// Interest-free / promotional period helpers
// ----------------------------------------------------------------------------

interface InterestFreeInfo {
  active: boolean;
  until: string; // ISO yyyy-mm-dd
  daysLeft: number;
  promoApr: number; // rate during the window (usually 0)
  revertApr: number; // rate once the window ends
}

/** Whole days between two ISO dates (b - a), floored. */
function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime();
  return Math.round(ms / 86_400_000);
}

/** Whole months between two ISO dates (b - a), clamped at 0. */
function monthsUntil(fromISO: string, toISO: string): number {
  return Math.max(0, Math.ceil(daysBetween(fromISO, toISO) / (365.25 / 12)));
}

function interestFreeInfo(debt: Debt, today = todayISO()): InterestFreeInfo | null {
  if (!debt.interest_free_until) return null;
  const daysLeft = daysBetween(today, debt.interest_free_until);
  return {
    active: daysLeft > 0,
    until: debt.interest_free_until,
    daysLeft,
    promoApr: debt.promo_apr ?? 0,
    revertApr: debt.apr ?? 0,
  };
}

/** APR that actually applies today, honouring any active interest-free window. */
function effectiveApr(debt: Debt, today = todayISO()): number {
  const info = interestFreeInfo(debt, today);
  if (info?.active) return info.promoApr;
  return debt.apr ?? 0;
}

function formatShortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ----------------------------------------------------------------------------
// Period sectioning
// ----------------------------------------------------------------------------

const ONGOING = "Ongoing & revolving";

/** Group debts into sections: each tax-year period, plus an "ongoing" bucket. */
function groupByPeriod(debts: Debt[]): Array<{ key: string; debts: Debt[] }> {
  const groups = new Map<string, Debt[]>();
  for (const d of debts) {
    const key = d.period ?? ONGOING;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(d);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      debts: [...list].sort((a, b) => b.current_balance - a.current_balance),
    }))
    .sort((a, b) => {
      // Ongoing first, then tax-year periods ascending (2025/26, 2026/27, …).
      if (a.key === ONGOING) return -1;
      if (b.key === ONGOING) return 1;
      return a.key.localeCompare(b.key);
    });
}

function payoffSchedule(debt: Debt, maxMonths = 120) {
  const points: Array<{ month: number; balance: number }> = [];
  let balance = debt.current_balance;
  const payment = debt.minimum_payment || balance / 12;
  const info = interestFreeInfo(debt);
  const freeMonths = info?.active ? monthsUntil(todayISO(), info.until) : 0;
  const promoRate = (info?.promoApr ?? 0) / 100 / 12;
  const stdRate = (debt.apr ?? 0) / 100 / 12;
  points.push({ month: 0, balance: Math.round(balance) });
  for (let m = 1; m <= maxMonths && balance > 0; m++) {
    const monthlyRate = m <= freeMonths ? promoRate : stdRate;
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

  const active = useMemo(() => debts.filter((d) => d.status === "active"), [debts]);

  const totals = useMemo(() => {
    const total = active.reduce((s, d) => s + d.current_balance, 0);
    const minPay = active.reduce((s, d) => s + (d.minimum_payment ?? 0), 0);
    const weightedApr =
      total > 0
        ? active.reduce((s, d) => s + effectiveApr(d) * d.current_balance, 0) / total
        : 0;
    const interestFree = active
      .filter((d) => interestFreeInfo(d)?.active)
      .reduce((s, d) => s + d.current_balance, 0);
    return { total, minPay, weightedApr, interestFree };
  }, [active]);

  // Promotions ending within 90 days — worth flagging before they revert.
  const endingSoon = useMemo(
    () =>
      active
        .map((d) => ({ debt: d, info: interestFreeInfo(d) }))
        .filter((x) => x.info?.active && x.info.daysLeft <= 90)
        .sort((a, b) => a.info!.daysLeft - b.info!.daysLeft),
    [active],
  );

  const sections = useMemo(() => groupByPeriod(debts), [debts]);

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
        icon={CreditCard}
        description="Balances, APR and payoff across cards, store cards, loans, car finance, BNPL, overdrafts, student loans, money owed to people and tax — with interest-free periods and tax-year sections."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total debt" value={formatGBP(totals.total)} accent="destructive" />
        <StatCard label="Min payments/mo" value={formatGBP(totals.minPay)} accent="warning" />
        <StatCard label="Weighted APR (now)" value={formatPct(totals.weightedApr, 1)} />
        <StatCard label="On 0% deals" value={formatGBP(totals.interestFree)} accent="success" />
      </div>

      {endingSoon.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-warning-foreground">
              Interest-free deals ending soon
            </p>
            <div className="mt-2 space-y-1 text-sm">
              {endingSoon.map(({ debt, info }) => (
                <div key={debt.id} className="flex items-center justify-between">
                  <span>
                    {debt.name} — 0% ends {formatShortDate(info!.until)}{" "}
                    <span className="text-muted-foreground">({info!.daysLeft}d left)</span>
                  </span>
                  <span className="text-destructive">
                    reverts to {formatPct(info!.revertApr, 1)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sections.map((section) => {
        const subtotal = section.debts.reduce((s, d) => s + d.current_balance, 0);
        return (
          <div key={section.key} className="space-y-3">
            <div className="flex items-baseline justify-between border-b pb-1.5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {section.key === ONGOING ? section.key : `Tax year ${section.key}`}
                <span className="ml-2 font-normal normal-case text-muted-foreground/70">
                  {section.debts.length} {section.debts.length === 1 ? "item" : "items"}
                </span>
              </h2>
              <span className="text-sm font-medium tnum text-destructive">{formatGBP(subtotal)}</span>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {section.debts.map((d) => {
                const paid = d.original_balance ? d.original_balance - d.current_balance : 0;
                const pct = d.original_balance ? (paid / d.original_balance) * 100 : 0;
                const info = interestFreeInfo(d);
                const eff = effectiveApr(d);
                return (
                  <Card key={d.id} className={selectedId === d.id ? "border-primary/50" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{d.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.debt_type === "personal" ? `Owed to ${d.lender ?? "—"}` : (d.lender ?? "—")} · {titleCase(d.debt_type)}
                            {accountById(d.account_id) ? ` · ${accountById(d.account_id)!.name}` : ""}
                          </p>
                        </div>
                        <Badge variant={d.status === "active" ? "warning" : "success"}>{titleCase(d.status)}</Badge>
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-semibold tnum text-destructive">{formatGBP(d.current_balance)}</p>
                          <p className="text-xs text-muted-foreground">
                            APR {formatPct(eff, 1)}
                            {d.minimum_payment ? ` · Min ${formatGBP(d.minimum_payment)}` : ""}
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
                      {info?.active && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-success/10 px-2.5 py-1.5 text-xs">
                          <Badge variant="success">{formatPct(info.promoApr, info.promoApr % 1 ? 1 : 0)} until {formatShortDate(info.until)}</Badge>
                          <span className="text-muted-foreground">
                            {info.daysLeft}d left · reverts to <span className="text-destructive">{formatPct(info.revertApr, 1)}</span>
                          </span>
                        </div>
                      )}
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
          </div>
        );
      })}

      {selected && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <SectionTitle icon={CreditCard}>Payoff timeline — {selected.name}</SectionTitle>
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
              At {formatGBP(selected.minimum_payment || selected.current_balance / 12)}/mo
              {interestFreeInfo(selected)?.active
                ? ` (0% until ${formatShortDate(selected.interest_free_until!)}, then ${formatPct(selected.apr ?? 0, 1)} APR)`
                : ` and ${formatPct(selected.apr ?? 0, 1)} APR`}
              , this clears in{" "}
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
