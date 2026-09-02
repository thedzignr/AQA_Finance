import type {
  CompanyProfile,
  DocumentLineItem,
  Invoice,
  InvoiceStatus,
  LineUnit,
  Quote,
  QuoteStatus,
  WorkEntry,
  WorkEntryType,
  WorkStreamCode,
} from "@/types/domain";
import { COMPANY } from "./company";
import { newId, roundMoney, todayISO } from "./utils";

export const LINE_UNITS: LineUnit[] = ["hours", "days", "miles", "shifts", "each"];

export const DEFAULT_INVOICE_TERMS =
  "Payment is due by the date shown. Please quote the invoice number as the payment reference.";

export const DEFAULT_QUOTE_TERMS =
  "This quote is valid until the date shown. Prices exclude expenses unless listed.";

const HMRC_MILEAGE_BAND = 10_000;
const HMRC_MILEAGE_HIGH = 0.45;
const HMRC_MILEAGE_LOW = 0.25;

export function emptyLineItem(vatRate = 0): DocumentLineItem {
  return {
    id: newId(),
    description: "",
    quantity: 1,
    unit: "each",
    unit_price: 0,
    vat_rate: vatRate,
  };
}

export function normaliseLineItems(raw: unknown): DocumentLineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = (item ?? {}) as Partial<DocumentLineItem>;
    return {
      id: row.id || newId(),
      description: row.description ?? "",
      quantity: Number(row.quantity) || 0,
      unit: (row.unit as LineUnit) || "each",
      unit_price: Number(row.unit_price) || 0,
      vat_rate: Number(row.vat_rate) || 0,
    };
  });
}

export function lineNet(item: DocumentLineItem): number {
  return roundMoney((Number(item.quantity) || 0) * (Number(item.unit_price) || 0));
}

export function lineVat(item: DocumentLineItem): number {
  return roundMoney(lineNet(item) * (Number(item.vat_rate) || 0) / 100);
}

export function lineGross(item: DocumentLineItem): number {
  return roundMoney(lineNet(item) + lineVat(item));
}

export function documentTotals(items: DocumentLineItem[]) {
  const lines = normaliseLineItems(items);
  const net = roundMoney(lines.reduce((s, i) => s + lineNet(i), 0));
  const vat = roundMoney(lines.reduce((s, i) => s + lineVat(i), 0));
  return { net, vat, gross: roundMoney(net + vat) };
}

export function formatDocNumber(
  prefix: string,
  seq: number,
  year = new Date().getFullYear(),
): string {
  const clean = (prefix || "DOC").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "DOC";
  return `${clean}-${year}-${String(Math.max(1, seq)).padStart(4, "0")}`;
}

export function invoiceBalance(invoice: Invoice): number {
  return roundMoney(Number(invoice.gross_amount) - Number(invoice.paid_amount || 0));
}

export type InvoiceDisplayStatus = InvoiceStatus | "overdue";

export function invoiceDisplayStatus(
  invoice: Invoice,
  today = todayISO(),
): InvoiceDisplayStatus {
  if (invoice.status === "void" || invoice.status === "paid" || invoice.status === "draft") {
    return invoice.status;
  }
  if (invoice.due_date && invoice.due_date < today) return "overdue";
  return invoice.status;
}

export function quoteDisplayStatus(quote: Quote, today = todayISO()): QuoteStatus {
  if (quote.status === "sent" && quote.valid_until && quote.valid_until < today) {
    return "expired";
  }
  return quote.status;
}

export function workEntryAmount(
  entry: Pick<WorkEntry, "amount" | "hours" | "miles" | "rate" | "entry_type">,
): number {
  if (entry.amount != null && Number(entry.amount) !== 0) {
    return roundMoney(Number(entry.amount));
  }
  const rate = Number(entry.rate) || 0;
  if (entry.entry_type === "mileage") {
    return roundMoney((Number(entry.miles) || 0) * rate);
  }
  if (entry.hours != null) {
    return roundMoney((Number(entry.hours) || 0) * rate);
  }
  return roundMoney(rate);
}

export function mileageAllowance(milesYtd: number): {
  allowance: number;
  remainingAtHigh: number;
} {
  const miles = Math.max(0, milesYtd);
  const highMiles = Math.min(miles, HMRC_MILEAGE_BAND);
  const lowMiles = Math.max(0, miles - HMRC_MILEAGE_BAND);
  return {
    allowance: roundMoney(highMiles * HMRC_MILEAGE_HIGH + lowMiles * HMRC_MILEAGE_LOW),
    remainingAtHigh: Math.max(0, HMRC_MILEAGE_BAND - miles),
  };
}

export function defaultEntryTypeForStream(code: WorkStreamCode | undefined): WorkEntryType {
  if (code === "phv" || code === "trade_plate") return "shift";
  if (code === "design" || code === "freelance") return "hours";
  return "hours";
}

export function defaultBillableForStream(code: WorkStreamCode | undefined): boolean {
  return code === "design" || code === "freelance";
}

export function paymentTermsDays(
  company: CompanyProfile | null | undefined,
  clientDays: number | null | undefined,
): number {
  if (clientDays != null && clientDays > 0) return clientDays;
  return company?.default_payment_terms_days ?? 14;
}

export function defaultInvoiceFooter(company: CompanyProfile | null | undefined): string {
  if (company?.invoice_footer) return company.invoice_footer;
  const bits: string[] = [];
  if (company?.legal_name) bits.push(company.legal_name);
  else bits.push(COMPANY.legalName);
  if (company?.company_number) bits.push(`Company no. ${company.company_number}`);
  else bits.push(`Company no. ${COMPANY.companyNumber}`);
  if (company?.vat_registered && company.vat_number) bits.push(`VAT ${company.vat_number}`);
  bits.push("Thank you for your business.");
  return bits.join(" · ");
}

export function companyDisplayName(company: CompanyProfile | null | undefined): string {
  return company?.trading_name || company?.legal_name || COMPANY.legalName;
}

export function lineItemFromWorkEntry(entry: WorkEntry): DocumentLineItem {
  const amount = workEntryAmount(entry);
  const isMileage = entry.entry_type === "mileage";
  const qty = isMileage
    ? Number(entry.miles) || 1
    : Number(entry.hours) || 1;
  const unit: LineUnit = isMileage
    ? "miles"
    : entry.entry_type === "shift"
      ? "shifts"
      : "hours";
  const unitPrice =
    qty > 0 && (entry.rate == null || Number(entry.rate) === 0)
      ? roundMoney(amount / qty)
      : Number(entry.rate) || amount;
  return {
    id: newId(),
    description: entry.description || `${entry.entry_type} ${entry.occurred_on}`,
    quantity: qty,
    unit,
    unit_price: unitPrice,
    vat_rate: 0,
  };
}
