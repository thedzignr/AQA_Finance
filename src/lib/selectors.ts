import type { Dataset } from "@/data/dataset";
import type {
  Account,
  Bill,
  DashboardSummary,
  TaxYearSummary,
  Transaction,
  WorkStream,
  WorkStreamSummary,
} from "@/types/domain";
import { monthKey } from "./utils";

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

export function estimatedMonthlyFixedCosts(data: Dataset): number {
  const billCost = data.bills
    .filter((b) => b.active)
    .reduce((sum, b) => {
      const amt = b.amount_estimate ?? 0;
      switch (b.frequency) {
        case "weekly":
          return sum + amt * 4.33;
        case "monthly":
          return sum + amt;
        case "quarterly":
          return sum + amt / 3;
        case "yearly":
          return sum + amt / 12;
        default:
          return sum + amt;
      }
    }, 0);
  const subCost = data.subscriptions
    .filter((s) => s.active)
    .reduce((sum, s) => {
      switch (s.billing_cycle) {
        case "weekly":
          return sum + s.amount_estimate * 4.33;
        case "monthly":
          return sum + s.amount_estimate;
        case "yearly":
          return sum + s.amount_estimate / 12;
        default:
          return sum + s.amount_estimate;
      }
    }, 0);
  return billCost + subCost;
}

export function workStreamLabel(
  ws: WorkStream | undefined,
  fallback = "Unassigned",
): string {
  return ws?.name ?? fallback;
}
