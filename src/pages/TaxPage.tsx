import { useMemo } from "react";
import { AlertTriangle, Banknote, Car, Download, FileCheck2, Percent, Receipt, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { SectionTitle } from "@/components/shared/IconWell";
import { StatCard } from "@/components/shared/StatCard";
import { Money } from "@/components/shared/Money";
import { useData } from "@/data/DataProvider";
import {
  estimateCorporationTax,
  estimateSelfEmployedTax,
  isLimitedCompany,
  taxYearSummary,
  vatSummary,
  ytdMileageAllowance,
} from "@/lib/selectors";
import { COMPANY } from "@/lib/company";
import { formatGBP, formatPct } from "@/lib/utils";

export function TaxPage() {
  const { data, categoryById } = useData();
  const summary = useMemo(() => taxYearSummary(data, "2025/26"), [data]);
  const ltd = useMemo(() => isLimitedCompany(data), [data]);
  const taxEst = useMemo(
    () => estimateSelfEmployedTax(summary.estimatedProfit),
    [summary.estimatedProfit],
  );
  const corpTax = useMemo(
    () => estimateCorporationTax(summary.estimatedProfit),
    [summary.estimatedProfit],
  );
  const vat = useMemo(
    () => vatSummary(data, summary.start, summary.end),
    [data, summary.start, summary.end],
  );
  const mileage = useMemo(() => ytdMileageAllowance(data), [data]);

  function exportCsv() {
    const lines: string[] = [];
    lines.push(`${COMPANY.legalName} — ${ltd ? "Limited company" : "Sole trader"} summary,${summary.taxYear}`);
    lines.push(`Period,${summary.start} to ${summary.end}`);
    lines.push("");
    lines.push("Totals");
    lines.push(`Total income,${summary.totalIncome.toFixed(2)}`);
    lines.push(`Total allowable expenses,${summary.totalAllowableExpenses.toFixed(2)}`);
    lines.push(`Estimated profit,${summary.estimatedProfit.toFixed(2)}`);
    if (ltd) {
      lines.push(`Estimated corporation tax,${corpTax.tax.toFixed(2)}`);
      lines.push(`CT effective rate %,${corpTax.effectiveRate.toFixed(2)}`);
      if (vat.vatRegistered) {
        lines.push(`Output VAT,${vat.outputVat.toFixed(2)}`);
        lines.push(`VAT scheme,${vat.scheme}`);
      }
    } else {
      lines.push(`Estimated income tax,${taxEst.incomeTax.toFixed(2)}`);
      lines.push(`Estimated Class 4 NIC,${taxEst.class4.toFixed(2)}`);
      lines.push(`Estimated total tax,${taxEst.total.toFixed(2)}`);
    }
    lines.push(`YTD miles,${mileage.miles.toFixed(1)}`);
    lines.push(`HMRC mileage allowance,${mileage.allowance.toFixed(2)}`);
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
        icon={ReceiptText}
        description={
          ltd
            ? `Company records for ${summary.taxYear} (${summary.start} to ${summary.end}). Corporation tax and VAT figures are indicative — confirm with your accountant.`
            : `UK sole trader records for tax year ${summary.taxYear} (${summary.start} to ${summary.end}). Estimates only — not a substitute for an accountant.`
        }
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
          label={ltd ? "Estimated CT" : "Estimated tax"}
          value={formatGBP(ltd ? corpTax.tax : taxEst.total)}
          hint={`~${formatPct(ltd ? corpTax.effectiveRate : taxEst.effectiveRate, 1)} effective`}
          accent="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Evidence coverage */}
        <Card>
          <CardHeader>
            <SectionTitle icon={ShieldCheck}>Evidence coverage</SectionTitle>
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
            <SectionTitle icon={FileCheck2}>Estimated liability</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {ltd ? (
              <>
                <Line label="Taxable profit" value={summary.estimatedProfit} />
                <Line label="Corporation tax" value={corpTax.tax} bold />
                <p className="pt-1 text-xs text-muted-foreground">
                  2025/26 rates: 19% on profits up to £50k, 25% above £250k, marginal relief between.
                  Due nine months after year-end. Does not include PAYE or dividend tax.
                </p>
              </>
            ) : (
              <>
                <Line label="Income tax" value={taxEst.incomeTax} />
                <Line label="Class 4 NIC" value={taxEst.class4} />
                <div className="my-1 border-t" />
                <Line label="Total" value={taxEst.total} bold />
                <p className="pt-1 text-xs text-muted-foreground">
                  Based on 2025/26 rates and a £12,570 personal allowance. Class 2 NIC and payments on account not included.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Missing evidence */}
        <Card>
          <CardHeader>
            <SectionTitle icon={AlertTriangle} variant="warning">Missing evidence</SectionTitle>
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

      {ltd && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <SectionTitle icon={Percent}>VAT</SectionTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {vat.vatRegistered ? (
                <>
                  <Line label="Net supplies" value={vat.outputNet} />
                  <Line label="Output VAT" value={vat.outputVat} bold />
                  <p className="pt-1 text-xs text-muted-foreground">
                    Scheme: {vat.scheme.replace("_", " ")}. Cash accounting uses paid invoices;
                    standard uses issue date. Input VAT from receipts is not auto-calculated yet.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not VAT registered. Turn it on in Settings when you cross the threshold or register.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <SectionTitle icon={Car}>Mileage (HMRC AMAP)</SectionTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Miles this year</span>
                <span className="tnum">{mileage.miles.toFixed(0)}</span>
              </div>
              <Line label="Tax-free allowance" value={mileage.allowance} bold />
              <p className="pt-1 text-xs text-muted-foreground">
                45p for the first 10,000 business miles, 25p after. Log miles on the Work log.
                {mileage.remainingAtHigh > 0
                  ? ` ${mileage.remainingAtHigh.toFixed(0)} miles still at 45p.`
                  : " You are now in the 25p band."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <SectionTitle icon={UserRound}>Paying yourself</SectionTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                The company pays corporation tax on its profits. You typically take a modest PAYE
                salary (ledger category Director salary) and the rest as dividends (Director dividend).
              </p>
              <p>
                Salary is a company expense; dividends are not. Record both in the ledger so profit
                and the tax pot stay honest.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Work stream summary */}
      <Card>
        <CardHeader>
          <SectionTitle icon={Banknote}>Work-stream summary ({summary.taxYear})</SectionTitle>
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
          <SectionTitle icon={Receipt}>Tax-relevant transactions</SectionTitle>
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
