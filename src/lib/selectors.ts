import type { Dataset } from "@/data/dataset";
import type {
  Account,
  Bill,
  BillingCycle,
  Client,
  CompanyProfile,
  DashboardSummary,
  Invoice,
  OperatingCost,
  OperatingCostCategory,
  TaxYearSummary,
  Transaction,
  WorkStream,
  WorkStreamSummary,
} from "@/types/domain";
import {
  invoiceBalance,
  invoiceDisplayStatus,
  mileageAllowance,
  quoteDisplayStatus,
  workEntryAmount,
} from "./commerce";
import { monthKey, roundMoney, startOfWeekISO, todayISO, weekDatesISO } from "./utils";

const CASH_ACCOUNT_TYPES: Account["account_type"][] = [
  "current",
  "savings",
  "cash",
  "tax_pot",
];

export function accountBalance(account: Account): number {
  return account.current_balance ?? account.opening_balance ?? 0;
}

/** Total liquid cash across asset accounts (excludes credit cards & loans). */
export function totalCash(data: Dataset): number {
  return data.accounts
    .filter((a) => a.active && CASH_ACCOUNT_TYPES.includes(a.account_type))
    .reduce((sum, a) => sum + accountBalance(a), 0);
}

export function totalDebt(data: Dataset): number {
  return data.debts
    .filter((d) => d.status === "active")
    .reduce((sum, d) => sum + d.current_balance, 0);
}

export function taxPotBalance(data: Dataset): number {
  return data.accounts
    .filter((a) => a.account_type === "tax_pot")
    .reduce((sum, a) => sum + accountBalance(a), 0);
}

export function isInMonth(dateISO: string, key = monthKey()): boolean {
  return dateISO.slice(0, 7) === key;
}

/** Money in/out for a month, excluding internal transfers. */
export function cashFlowForMonth(data: Dataset, key = monthKey()) {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const t of data.transactions) {
    if (!isInMonth(t.transaction_date, key)) continue;
    if (t.kind === "transfer") continue;
    if (t.direction === "inflow") moneyIn += t.amount;
    else moneyOut += t.amount;
  }
  return { moneyIn, moneyOut, net: moneyIn - moneyOut };
}

export function monthlyCashFlowTrend(data: Dataset, months = 12) {
  const now = new Date();
  const rows: Array<{ month: string; income: number; expense: number; net: number }> = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const { moneyIn, moneyOut, net } = cashFlowForMonth(data, key);
    rows.push({
      month: d.toLocaleString("en-GB", { month: "short" }),
      income: moneyIn,
      expense: moneyOut,
      net,
    });
  }
  return rows;
}

/** Allowable (deductible) portion of a business expense. */
export function allowableAmount(t: Transaction): number {
  if (t.direction !== "outflow") return 0;
  if (t.ownership_type === "personal") return 0;
  return (t.amount * t.business_use_pct) / 100;
}

export function workStreamSummaries(
  data: Dataset,
  filter?: (t: Transaction) => boolean,
): WorkStreamSummary[] {
  return data.workStreams.map((workStream) => {
    const txns = data.transactions.filter(
      (t) =>
        t.work_stream_id === workStream.id &&
        t.kind !== "transfer" &&
        (filter ? filter(t) : true),
    );
    let income = 0;
    let expenses = 0;
    for (const t of txns) {
      if (t.direction === "inflow") income += t.amount;
      else expenses += t.amount;
    }
    return {
      workStream,
      income,
      expenses,
      net: income - expenses,
      transactionCount: txns.length,
    };
  });
}

export function nextDueDateForBill(bill: Bill, from = new Date()): string {
  const day = bill.due_day ?? 1;
  const candidate = new Date(from.getFullYear(), from.getMonth(), day);
  if (candidate < from) candidate.setMonth(candidate.getMonth() + 1);
  return candidate.toISOString().slice(0, 10);
}

export function upcomingBills(data: Dataset, withinDays = 30) {
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + withinDays);
  return data.bills
    .filter((b) => b.active)
    .map((bill) => {
      const dueDate = nextDueDateForBill(bill, now);
      return { bill, dueDate, amount: bill.amount_estimate ?? 0 };
    })
    .filter((b) => new Date(b.dueDate) <= horizon)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function dashboardSummary(data: Dataset): DashboardSummary {
  const { moneyIn, moneyOut } = cashFlowForMonth(data);
  const cash = totalCash(data);
  const debt = totalDebt(data);
  return {
    totalCash: cash,
    moneyInThisMonth: moneyIn,
    moneyOutThisMonth: moneyOut,
    debtTotal: debt,
    taxPotBalance: taxPotBalance(data),
    upcomingBills: upcomingBills(data, 30),
    savingsGoals: data.savingsGoals,
    recentTransactions: [...data.transactions]
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
      .slice(0, 8),
    reviewItems: data.reviewTasks.filter((t) => t.status === "open").length,
    workStreamSummary: workStreamSummaries(data),
    netWorth: cash - debt,
  };
}

/** UK tax year boundaries for a given "YYYY/YY" label. */
export function taxYearBounds(taxYear = "2025/26") {
  const startYear = parseInt(taxYear.slice(0, 4), 10);
  return {
    start: `${startYear}-04-06`,
    end: `${startYear + 1}-04-05`,
  };
}

export function taxYearSummary(data: Dataset, taxYear = "2025/26"): TaxYearSummary {
  const { start, end } = taxYearBounds(taxYear);
  const inYear = (t: Transaction) =>
    t.transaction_date >= start && t.transaction_date <= end;

  const businessTxns = data.transactions.filter(
    (t) => inYear(t) && t.kind !== "transfer" && t.ownership_type !== "personal",
  );

  let totalIncome = 0;
  let totalAllowableExpenses = 0;
  for (const t of businessTxns) {
    if (t.direction === "inflow" && t.kind === "income") totalIncome += t.amount;
    else if (t.direction === "outflow") totalAllowableExpenses += allowableAmount(t);
  }

  const taxRelevantExpenses = data.transactions.filter(
    (t) => inYear(t) && t.tax_relevant && t.direction === "outflow",
  );
  const withEvidence = taxRelevantExpenses.filter((t) => t.linked_document_id);
  const taxRelevantWithoutEvidence = taxRelevantExpenses.filter(
    (t) => !t.linked_document_id,
  );

  const byWorkStream = workStreamSummaries(data, inYear);

  return {
    taxYear,
    start,
    end,
    totalIncome,
    totalAllowableExpenses,
    estimatedProfit: totalIncome - totalAllowableExpenses,
    byWorkStream,
    taxRelevantWithoutEvidence,
    evidenceCoveragePct: taxRelevantExpenses.length
      ? (withEvidence.length / taxRelevantExpenses.length) * 100
      : 100,
  };
}

/** Simple progressive estimate of income tax + Class 4 NIC for a sole trader. */
export function estimateSelfEmployedTax(profit: number, taxYear = "2025/26") {
  void taxYear;
  const personalAllowance = 12570;
  const basicRateLimit = 50270;
  const taxable = Math.max(0, profit - personalAllowance);

  // Income tax (2025/26 rates: 20% basic, 40% higher)
  let incomeTax = 0;
  const basicBand = Math.min(taxable, basicRateLimit - personalAllowance);
  incomeTax += basicBand * 0.2;
  const higherBand = Math.max(0, taxable - (basicRateLimit - personalAllowance));
  incomeTax += higherBand * 0.4;

  // Class 4 NIC (2025/26: 6% between LPL 12,570 and UPL 50,270, 2% above)
  let class4 = 0;
  const niBasic = Math.max(0, Math.min(profit, basicRateLimit) - personalAllowance);
  class4 += niBasic * 0.06;
  const niUpper = Math.max(0, profit - basicRateLimit);
  class4 += niUpper * 0.02;

  return {
    incomeTax,
    class4,
    total: incomeTax + class4,
    effectiveRate: profit > 0 ? ((incomeTax + class4) / profit) * 100 : 0,
  };
}

export function categorySpendForMonth(
  data: Dataset,
  categoryId: string,
  key = monthKey(),
): number {
  return data.transactions
    .filter(
      (t) =>
        t.category_id === categoryId &&
        t.direction === "outflow" &&
        isInMonth(t.transaction_date, key),
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Monthly net by work stream for the last N months (for trend charts). */
export function workStreamMonthlyTrend(data: Dataset, months = 6) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys.map((key) => {
    const row: Record<string, number | string> = { month: key };
    for (const ws of data.workStreams) {
      const net = data.transactions
        .filter(
          (t) =>
            t.work_stream_id === ws.id &&
            t.kind !== "transfer" &&
            isInMonth(t.transaction_date, key),
        )
        .reduce(
          (sum, t) => sum + (t.direction === "inflow" ? t.amount : -t.amount),
          0,
        );
      row[ws.code] = Math.round(net);
    }
    return row;
  });
}

// ----------------------------------------------------------------------------
// Running costs — recurring outgoings normalised to a monthly figure
// ----------------------------------------------------------------------------

const WEEKS_PER_MONTH = 4.33;

export type RunningCostGroup = "bill" | "subscription" | "debt";

export interface RunningCostItem {
  id: string;
  name: string;
  group: RunningCostGroup;
  cadence: string; // human label, e.g. "Monthly", "Yearly"
  rawAmount: number; // amount charged per its own cadence
  monthly: number; // normalised to a monthly figure
}

export interface RunningCostsSummary {
  items: RunningCostItem[]; // sorted by monthly cost, descending
  byGroup: Record<RunningCostGroup, number>;
  monthlyTotal: number;
  yearlyTotal: number;
}

function monthlyFromBillFrequency(amount: number, frequency: Bill["frequency"]): number {
  switch (frequency) {
    case "weekly":
      return amount * WEEKS_PER_MONTH;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
}

function cadenceLabel(frequency: string): string {
  switch (frequency) {
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "quarterly":
      return "Quarterly";
    case "yearly":
      return "Yearly";
    default:
      return "Custom";
  }
}

/**
 * Recurring "running costs" of the user's finances — active bills,
 * subscriptions and minimum debt payments — each normalised to a comparable
 * monthly amount, with per-group and overall totals.
 */
export function runningCosts(data: Dataset): RunningCostsSummary {
  const items: RunningCostItem[] = [];

  for (const b of data.bills) {
    if (!b.active) continue;
    const raw = b.amount_estimate ?? 0;
    if (raw <= 0) continue;
    items.push({
      id: b.id,
      name: b.name,
      group: "bill",
      cadence: cadenceLabel(b.frequency),
      rawAmount: raw,
      monthly: monthlyFromBillFrequency(raw, b.frequency),
    });
  }

  for (const s of data.subscriptions) {
    if (!s.active) continue;
    const raw = s.amount_estimate;
    if (raw <= 0) continue;
    const monthly =
      s.billing_cycle === "weekly"
        ? raw * WEEKS_PER_MONTH
        : s.billing_cycle === "yearly"
          ? raw / 12
          : raw;
    items.push({
      id: s.id,
      name: s.name,
      group: "subscription",
      cadence: cadenceLabel(s.billing_cycle),
      rawAmount: raw,
      monthly,
    });
  }

  for (const d of data.debts) {
    if (d.status !== "active") continue;
    const min = d.minimum_payment ?? 0;
    if (min <= 0) continue;
    items.push({
      id: d.id,
      name: d.name,
      group: "debt",
      cadence: "Monthly",
      rawAmount: min,
      monthly: min,
    });
  }

  items.sort((a, b) => b.monthly - a.monthly);

  const byGroup: Record<RunningCostGroup, number> = { bill: 0, subscription: 0, debt: 0 };
  for (const item of items) byGroup[item.group] += item.monthly;
  const monthlyTotal = byGroup.bill + byGroup.subscription + byGroup.debt;

  return { items, byGroup, monthlyTotal, yearlyTotal: monthlyTotal * 12 };
}

/**
 * Estimated monthly fixed costs (bills + subscriptions only — excludes debt
 * minimums). Kept for callers that want the pre-debt figure.
 */
export function estimatedMonthlyFixedCosts(data: Dataset): number {
  const { byGroup } = runningCosts(data);
  return byGroup.bill + byGroup.subscription;
}

// ----------------------------------------------------------------------------
// App running costs — the AQA Finance product's own operating costs
// ----------------------------------------------------------------------------

function monthlyFromCycle(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case "weekly":
      return amount * WEEKS_PER_MONTH;
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
}

export interface AppRunningCostItem extends OperatingCost {
  monthly: number;
}

export interface AppRunningCostsSummary {
  items: AppRunningCostItem[]; // active costs, sorted by monthly spend desc
  byCategory: Array<{ category: OperatingCostCategory; monthly: number }>;
  monthlyTotal: number;
  yearlyTotal: number;
  usageBasedMonthly: number; // portion that is metered/variable
}

/**
 * Operating costs of running the AQA Finance app itself (Claude API, Vercel,
 * Supabase, domain, …), each normalised to a monthly figure with category and
 * overall totals.
 */
export function appRunningCosts(data: Dataset): AppRunningCostsSummary {
  const items: AppRunningCostItem[] = (data.operatingCosts ?? [])
    .filter((c) => c.active)
    .map((c) => ({ ...c, monthly: monthlyFromCycle(c.amount_estimate, c.billing_cycle) }))
    .sort((a, b) => b.monthly - a.monthly);

  const catMap = new Map<OperatingCostCategory, number>();
  let usageBasedMonthly = 0;
  for (const item of items) {
    catMap.set(item.category, (catMap.get(item.category) ?? 0) + item.monthly);
    if (item.usage_based) usageBasedMonthly += item.monthly;
  }
  const byCategory = [...catMap.entries()]
    .map(([category, monthly]) => ({ category, monthly }))
    .sort((a, b) => b.monthly - a.monthly);

  const monthlyTotal = items.reduce((s, i) => s + i.monthly, 0);
  return { items, byCategory, monthlyTotal, yearlyTotal: monthlyTotal * 12, usageBasedMonthly };
}

export function workStreamLabel(
  ws: WorkStream | undefined,
  fallback = "Unassigned",
): string {
  return ws?.name ?? fallback;
}

// ----------------------------------------------------------------------------
// LTD operations — sales, VAT, work log, corporation tax
// ----------------------------------------------------------------------------

export function companyProfile(data: Dataset): CompanyProfile | undefined {
  return data.companyProfiles[0];
}

export interface SalesSummary {
  outstanding: number;
  overdue: number;
  overdueCount: number;
  paidThisMonth: number;
  draftCount: number;
  sentCount: number;
  quotesAwaiting: number;
  quotePipeline: number;
}

export function salesSummary(data: Dataset, today = todayISO()): SalesSummary {
  const invoices = data.invoices ?? [];
  let outstanding = 0;
  let overdue = 0;
  let overdueCount = 0;
  let paidThisMonth = 0;
  let draftCount = 0;
  let sentCount = 0;

  for (const inv of invoices) {
    if (inv.status === "void") continue;
    const remaining = invoiceBalance(inv);
    const display = invoiceDisplayStatus(inv, today);
    if (inv.status === "draft") draftCount += 1;
    if (inv.status === "sent" || inv.status === "part_paid") sentCount += 1;
    if (inv.status === "paid") {
      if (inv.paid_date && isInMonth(inv.paid_date)) {
        paidThisMonth += Number(inv.gross_amount) || 0;
      }
      continue;
    }
    outstanding += remaining;
    if (display === "overdue") {
      overdue += remaining;
      overdueCount += 1;
    }
  }

  const quotes = (data.quotes ?? []).filter((q) => {
    const status = quoteDisplayStatus(q, today);
    return status === "draft" || status === "sent" || status === "accepted";
  });

  return {
    outstanding: roundMoney(outstanding),
    overdue: roundMoney(overdue),
    overdueCount,
    paidThisMonth: roundMoney(paidThisMonth),
    draftCount,
    sentCount,
    quotesAwaiting: quotes.length,
    quotePipeline: roundMoney(quotes.reduce((s, q) => s + (Number(q.gross_amount) || 0), 0)),
  };
}

export function clientOutstanding(data: Dataset, clientId: string): number {
  return roundMoney(
    (data.invoices ?? [])
      .filter(
        (i) =>
          i.client_id === clientId && i.status !== "void" && i.status !== "paid",
      )
      .reduce((s, i) => s + invoiceBalance(i), 0),
  );
}

export interface VatSummary {
  outputVat: number;
  outputNet: number;
  scheme: CompanyProfile["vat_scheme"];
  vatRegistered: boolean;
}

export function vatSummary(
  data: Dataset,
  start: string,
  end: string,
): VatSummary {
  const company = companyProfile(data);
  const cash = company?.vat_scheme === "cash_accounting";
  let outputVat = 0;
  let outputNet = 0;
  for (const inv of data.invoices ?? []) {
    if (inv.status === "void") continue;
    const date = cash ? inv.paid_date ?? "" : inv.issue_date;
    if (!date || date < start || date > end) continue;
    if (cash && inv.status !== "paid" && inv.status !== "part_paid") continue;
    const share =
      cash && Number(inv.gross_amount)
        ? Number(inv.paid_amount) / Number(inv.gross_amount)
        : 1;
    outputVat += (Number(inv.vat_amount) || 0) * share;
    outputNet += (Number(inv.net_amount) || 0) * share;
  }
  return {
    outputVat: roundMoney(outputVat),
    outputNet: roundMoney(outputNet),
    scheme: company?.vat_scheme ?? "none",
    vatRegistered: Boolean(company?.vat_registered),
  };
}

export interface WorkLogSummary {
  hours: number;
  miles: number;
  amount: number;
  unbilled: number;
  count: number;
  byDay: Record<string, number>;
}

export function workLogSummary(
  data: Dataset,
  from: string,
  to: string,
): WorkLogSummary {
  const entries = (data.workEntries ?? []).filter(
    (e) => e.occurred_on >= from && e.occurred_on <= to,
  );
  let hours = 0;
  let miles = 0;
  let amount = 0;
  let unbilled = 0;
  const byDay: Record<string, number> = {};
  for (const e of entries) {
    hours += Number(e.hours) || 0;
    miles += Number(e.miles) || 0;
    const a = workEntryAmount(e);
    amount += a;
    if (e.billable && !e.invoiced) unbilled += a;
    byDay[e.occurred_on] = (byDay[e.occurred_on] ?? 0) + (Number(e.hours) || 0);
  }
  return {
    hours: roundMoney(hours),
    miles: roundMoney(miles),
    amount: roundMoney(amount),
    unbilled: roundMoney(unbilled),
    count: entries.length,
    byDay,
  };
}

export function thisWeekWorkLog(data: Dataset): WorkLogSummary {
  const days = weekDatesISO();
  return workLogSummary(data, days[0], days[6]);
}

export function thisWeekHoursByDay(data: Dataset): Array<{ date: string; hours: number }> {
  const days = weekDatesISO();
  const summary = workLogSummary(data, days[0], days[6]);
  return days.map((date) => ({ date, hours: summary.byDay[date] ?? 0 }));
}

export function ytdMileage(data: Dataset, year = new Date().getFullYear()): number {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  return (data.workEntries ?? [])
    .filter((e) => e.occurred_on >= start && e.occurred_on <= end)
    .reduce((s, e) => s + (Number(e.miles) || 0), 0);
}

export function ytdMileageAllowance(data: Dataset, year = new Date().getFullYear()) {
  const miles = ytdMileage(data, year);
  return { miles, ...mileageAllowance(miles) };
}

/** UK corporation tax 2025/26: 19% ≤ £50k, 25% ≥ £250k, marginal relief between. */
export function estimateCorporationTax(profit: number) {
  const p = Math.max(0, profit);
  if (p === 0) return { tax: 0, effectiveRate: 0, band: "none" as const };
  if (p <= 50_000) {
    return { tax: roundMoney(p * 0.19), effectiveRate: 19, band: "small" as const };
  }
  if (p >= 250_000) {
    return { tax: roundMoney(p * 0.25), effectiveRate: 25, band: "main" as const };
  }
  const tax = roundMoney(p * 0.25 - (250_000 - p) * (3 / 200));
  return {
    tax,
    effectiveRate: p > 0 ? (tax / p) * 100 : 0,
    band: "marginal" as const,
  };
}

export function isLimitedCompany(data: Dataset): boolean {
  return (companyProfile(data)?.entity_type ?? "limited_company") === "limited_company";
}

export function overdueInvoices(data: Dataset, today = todayISO()): Invoice[] {
  return (data.invoices ?? [])
    .filter((i) => invoiceDisplayStatus(i, today) === "overdue")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
}

export function recentQuotes(data: Dataset) {
  return [...(data.quotes ?? [])].sort((a, b) =>
    b.issue_date.localeCompare(a.issue_date),
  );
}

export function clientByIdMap(data: Dataset): Map<string, Client> {
  return new Map((data.clients ?? []).map((c) => [c.id, c]));
}

export function startOfCurrentWeek(): string {
  return startOfWeekISO();
}
