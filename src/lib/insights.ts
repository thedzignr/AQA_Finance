import type { Dataset } from "@/data/dataset";
import type { DocumentRecord, Transaction } from "@/types/domain";

export interface Insight {
  id: string;
  type:
    | "recurring_bill"
    | "duplicate_upload"
    | "anomaly"
    | "tax_pot_suggestion"
    | "unreconciled"
    | "missing_evidence";
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  amount?: number;
}

const TAX_POT_RATE = 0.25;

/** Detect likely recurring bills from repeated merchant + similar amount. */
export function detectRecurringBills(data: Dataset): Insight[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of data.transactions) {
    if (t.direction !== "outflow" || t.kind === "transfer") continue;
    const key = (t.counterparty ?? t.description).toLowerCase().trim();
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  const knownBillNames = new Set(
    [...data.bills, ...data.subscriptions].map((b) => b.name.toLowerCase()),
  );
  const insights: Insight[] = [];
  for (const [key, txns] of groups) {
    if (txns.length < 2) continue;
    if (knownBillNames.has(key)) continue;
    const avg = txns.reduce((s, t) => s + t.amount, 0) / txns.length;
    const spread = Math.max(...txns.map((t) => t.amount)) - Math.min(...txns.map((t) => t.amount));
    if (spread / avg > 0.25) continue; // amounts too variable to be a fixed bill
    insights.push({
      id: `recurring_${key}`,
      type: "recurring_bill",
      severity: "low",
      title: `Possible recurring bill: ${txns[0].counterparty ?? txns[0].description}`,
      detail: `Seen ${txns.length} times, ~£${avg.toFixed(2)} each. Add it to Bills to track upcoming due dates.`,
      amount: avg,
    });
  }
  return insights;
}

/** Detect duplicate document uploads by checksum or supplier+amount+date. */
export function detectDuplicateUploads(data: Dataset): Insight[] {
  const byChecksum = new Map<string, DocumentRecord[]>();
  for (const d of data.documents) {
    const list = byChecksum.get(d.checksum) ?? [];
    list.push(d);
    byChecksum.set(d.checksum, list);
  }
  const insights: Insight[] = [];
  for (const [checksum, docs] of byChecksum) {
    if (docs.length > 1) {
      insights.push({
        id: `dup_${checksum}`,
        type: "duplicate_upload",
        severity: "medium",
        title: `Duplicate upload detected`,
        detail: `${docs.length} files share the same checksum (${docs.map((d) => d.file_name).join(", ")}).`,
      });
    }
  }
  // Heuristic: same extraction supplier + total within a short window.
  const ex = data.extractions;
  for (let i = 0; i < ex.length; i++) {
    for (let j = i + 1; j < ex.length; j++) {
      const a = ex[i].normalized_json;
      const b = ex[j].normalized_json;
      if (a.supplier && a.supplier === b.supplier && a.total && a.total === b.total) {
        insights.push({
          id: `dup_ex_${ex[i].id}_${ex[j].id}`,
          type: "duplicate_upload",
          severity: "medium",
          title: `Possible duplicate receipt: ${a.supplier}`,
          detail: `Two extractions show ${a.supplier} for £${a.total?.toFixed(2)}.`,
          amount: a.total ?? undefined,
        });
      }
    }
  }
  return insights;
}

/** Flag unusually high spending vs category average. */
export function detectAnomalies(data: Dataset): Insight[] {
  const byCategory = new Map<string, number[]>();
  for (const t of data.transactions) {
    if (t.direction !== "outflow" || !t.category_id) continue;
    const list = byCategory.get(t.category_id) ?? [];
    list.push(t.amount);
    byCategory.set(t.category_id, list);
  }
  const insights: Insight[] = [];
  for (const t of data.transactions) {
    if (t.direction !== "outflow" || !t.category_id) continue;
    const amounts = byCategory.get(t.category_id) ?? [];
    if (amounts.length < 3) continue;
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    if (avg > 0 && t.amount > avg * 3 && t.amount > 200) {
      insights.push({
        id: `anomaly_${t.id}`,
        type: "anomaly",
        severity: "high",
        title: `Unusually high spend: ${t.description}`,
        detail: `£${t.amount.toFixed(2)} is ${(t.amount / avg).toFixed(1)}× the category average.`,
        amount: t.amount,
      });
    }
  }
  return insights;
}

/** Suggest a tax-pot transfer when business income is received. */
export function suggestTaxPotTransfers(data: Dataset): Insight[] {
  return data.transactions
    .filter(
      (t) =>
        t.kind === "income" &&
        t.direction === "inflow" &&
        t.ownership_type !== "personal" &&
        t.tax_relevant,
    )
    .slice(0, 5)
    .map((t) => ({
      id: `taxpot_${t.id}`,
      type: "tax_pot_suggestion" as const,
      severity: "medium" as const,
      title: `Set aside tax on ${t.counterparty ?? t.description}`,
      detail: `Received £${t.amount.toFixed(2)}. Suggest moving £${(t.amount * TAX_POT_RATE).toFixed(2)} (25%) to your Tax Pot.`,
      amount: t.amount * TAX_POT_RATE,
    }));
}

/** Tax-relevant expenses with no supporting document. */
export function detectMissingEvidence(data: Dataset): Insight[] {
  return data.transactions
    .filter((t) => t.tax_relevant && t.direction === "outflow" && !t.linked_document_id)
    .map((t) => ({
      id: `evidence_${t.id}`,
      type: "missing_evidence" as const,
      severity: "high" as const,
      title: `Missing evidence: ${t.description}`,
      detail: `£${t.amount.toFixed(2)} is claimed as tax-relevant but has no receipt attached.`,
      amount: t.amount,
    }));
}

export function detectUnreconciled(data: Dataset): Insight[] {
  const count = data.bankTransactions.filter(
    (b) => b.reconciliation_status === "unreconciled",
  ).length;
  if (count === 0) return [];
  return [
    {
      id: "unreconciled_all",
      type: "unreconciled",
      severity: "low",
      title: `${count} unreconciled bank ${count === 1 ? "row" : "rows"}`,
      detail: "Match imported bank rows to ledger transactions to keep accounts accurate.",
    },
  ];
}

export function allInsights(data: Dataset): Insight[] {
  return [
    ...detectAnomalies(data),
    ...detectMissingEvidence(data),
    ...detectDuplicateUploads(data),
    ...suggestTaxPotTransfers(data),
    ...detectRecurringBills(data),
    ...detectUnreconciled(data),
  ];
}
