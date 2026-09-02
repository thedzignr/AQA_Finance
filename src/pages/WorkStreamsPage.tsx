import { useMemo } from "react";
import { Banknote } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionTitle } from "@/components/shared/IconWell";
import { Money } from "@/components/shared/Money";
import { useData } from "@/data/DataProvider";
import { workStreamMonthlyTrend, workStreamSummaries } from "@/lib/selectors";
import { formatGBP } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/palette";

export function WorkStreamsPage() {
  const { data } = useData();
  const summaries = useMemo(() => workStreamSummaries(data), [data]);
  const trend = useMemo(() => workStreamMonthlyTrend(data, 6), [data]);
  const trendData = trend.map((row) => ({ ...row, month: String(row.month).slice(5) }));

  const totals = summaries.reduce(
    (acc, s) => ({
      income: acc.income + s.income,
      expenses: acc.expenses + s.expenses,
      net: acc.net + s.net,
    }),
    { income: 0, expenses: 0, net: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Streams"
        icon={Banknote}
        description="Ledger profit by stream. Log the actual hours, shifts and mileage on the Work log, then invoice from there."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summaries.map((s, i) => (
          <Card key={s.workStream.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <div className="flex items-center gap-1.5">
                  {!s.workStream.tracks_expenses && <Badge variant="secondary">Wage</Badge>}
                  <Badge variant="muted">{s.transactionCount}</Badge>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium">{s.workStream.name}</p>
              <p className="mt-1 text-xl font-semibold tnum">
                <Money value={s.net} colored signed />
              </p>
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <div className="flex justify-between"><span>Income</span><span>{formatGBP(s.income)}</span></div>
                {s.workStream.tracks_expenses ? (
                  <div className="flex justify-between"><span>Expenses</span><span>{formatGBP(s.expenses)}</span></div>
                ) : (
                  <div className="flex justify-between"><span>Expenses</span><span>Covered by operator</span></div>
                )}
              </div>
              {s.workStream.notes && (
                <p className="mt-2 border-t pt-2 text-[11px] leading-snug text-muted-foreground">
                  {s.workStream.notes}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total income</p><p className="mt-1 text-2xl font-semibold text-success tnum">{formatGBP(totals.income)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total expenses</p><p className="mt-1 text-2xl font-semibold text-destructive tnum">{formatGBP(totals.expenses)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Net profit</p><p className="mt-1 text-2xl font-semibold text-primary tnum">{formatGBP(totals.net)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <SectionTitle icon={Banknote}>Monthly net by work stream</SectionTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={trendData} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatGBP(v, { compact: true })} />
              <RTooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatGBP(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {data.workStreams.map((w, i) => (
                <Bar key={w.id} dataKey={w.code} name={w.name} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
