import { useMemo } from "react";
import { AlertTriangle, Download, FileCheck2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useData } from "@/data/DataProvider";
import {
  estimateSelfEmployedTax,
  taxYearSummary,
} from "@/lib/selectors";
import { formatGBP, formatPct } from "@/lib/utils";

export function TaxPage() {
  const { data, categoryById } = useData();
  const summary = useMemo(() => taxYearSummary(data, "2025/26"), [data]);
  const taxEst = useMemo(
    () => estimateSelfEmployedTax(summary.estimatedProfit),
    [summary.estimatedProfit],
  );

  function exportCsv() {
    const lines: string[] = [];
    lines.push(`AQA Finance — Sole Trader Summary,${summary.taxYear}`);
    lines.push(`Period,${summary.start} to ${summary.end}`);
    lines.push("");
    lines.push("Totals");
    lines.push(`Total income,${summary.totalIncome.toFixed(2)}`);
    lines.push(`Total allowable expenses,${summary.totalAllowableExpenses.toFixed(2)}`);
    lines.push(`Estimated profit,${summary.estimatedProfit.toFixed(2)}`);
    lines.push(`Estimated income tax,${taxEst.incomeTax.toFixed(2)}`);
    lines.push(`Estimated Class 4 NIC,${taxEst.class4.toFixed(2)}`);
    lines.push(`Estimated total tax,${taxEst.total.toFixed(2)}`);
    lines.push("");
    lines.push("By work stream,Income,Expenses,Net");
    for (const w of summary.byWorkStream) {
      lines.push(`${w.workStream.name},${w.income.toFixed(2)},${w.expenses.toFixed(2)},${w.net.toFixed(2)}`);
    }
    lines.push("");
    lines.push("Tax-relevant transactions,Date,Description,Category,Amount,Evidence");
    for (const t of data.transactions.filter(
      (t) => t.tax_relevant && t.transaction_date >= summary.start && t.transaction_date <= summary.end,
    )) {
      lines.push(
        `,${t.transaction_date},"${t.description}",${categoryById(t.category_id)?.name ?? ""},${t.amount.toFixed(2)},${t.linked_document_id ? "Yes" : "No"}`,
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aqa-tax-summary-${summary.taxYear.replace("/", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tax & Records"
        description={`UK sole trader records for tax year ${summary.taxYear} (${summary.start} to ${summary.end}). Estimates only — not a substitute for an accountant.`}
        actions={
          <Button onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export summary (CSV)
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Income" value={formatGBP(summary.totalIncome)} accent="success" />
        <StatCard label="Allowable expenses" value={formatGBP(summary.totalAllowableExpenses)} accent="destructive" />
        <StatCard label="Estimated profit" value={formatGBP(summary.estimatedProfit)} accent="primary" />
        <StatCard
          label="Estimated tax"
          value={formatGBP(taxEst.total)}
          hint={`~${formatPct(taxEst.effectiveRate, 1)} effective`}
          accent="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Evidence coverage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Evidence coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-3xl font-semibold tnum">
                {Math.round(summary.evidenceCoveragePct)}%
              </span>
              <span className="text-sm text-muted-foreground">of tax-relevant expenses</span>
            </div>
            <Progress
              value={summary.evidenceCoveragePct}
              indicatorClassName={summary.evidenceCoveragePct >= 90 ? "bg-success" : summary.evidenceCoveragePct >= 70 ? "bg-warning" : "bg-destructive"}
            />
            <p className="text-xs text-muted-foreground">
              Every tax-relevant transaction should be traceable to a receipt, invoice or statement.
            </p>
          </CardContent>
        </Card>

        {/* Tax estimate breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4" /> Estimated liability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Line label="Income tax" value={taxEst.incomeTax} />
            <Line label="Class 4 NIC" value={taxEst.class4} />
            <div className="my-1 border-t" />
            <Line label="Total" value={taxEst.total} bold />
            <p className="pt-1 text-xs text-muted-foreground">
              Based on 2025/26 rates and a £12,570 personal allowance. Class 2 NIC and payments on account not included.
            </p>
          </CardContent>
        </Card>

        {/* Missing evidence */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Missing evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.taxRelevantWithoutEvidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">All tax-relevant expenses have evidence. 🎯</p>
            ) : (
              summary.taxRelevantWithoutEvidence.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                  <span className="truncate">{t.description}</span>
                  <Money value={t.amount} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Work stream summary */}
      <Card>
        <CardHeader>
          <CardTitle>Work-stream summary ({summary.taxYear})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work stream</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byWorkStream.map((w) => (
                <TableRow key={w.workStream.id}>
                  <TableCell className="font-medium">{w.workStream.name}</TableCell>
                  <TableCell className="text-right"><Money value={w.income} /></TableCell>
                  <TableCell className="text-right"><Money value={w.expenses} /></TableCell>
                  <TableCell className="text-right"><Money value={w.net} colored signed /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tax-relevant ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Tax-relevant transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.transactions
                .filter(
                  (t) =>
                    t.tax_relevant &&
                    t.transaction_date >= summary.start &&
                    t.transaction_date <= summary.end,
                )
                .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
                .map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{t.transaction_date}</TableCell>
                    <TableCell className="font-medium">{t.description}</TableCell>
                    <TableCell className="text-muted-foreground">{categoryById(t.category_id)?.name ?? "—"}</TableCell>
                    <TableCell className="text-right"><Money value={t.direction === "inflow" ? t.amount : -t.amount} colored signed /></TableCell>
                    <TableCell>
                      {t.linked_document_id ? (
                        <Badge variant="success">Attached</Badge>
                      ) : (
                        <Badge variant="warning">Missing</Badge>
                      )}
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

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <Money value={value} className={bold ? "font-semibold" : ""} />
    </div>
  );
}
