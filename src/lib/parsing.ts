import type {
  Direction,
  DocumentType,
  ExtractionRawJson,
  NormalizedExtraction,
  WorkStreamCode,
} from "../types/domain";
import { todayISO } from "./utils";

export const EXTRACTOR_VERSION = "aqa-mock-extractor@1.3.0";

export interface ParseInput {
  fileName: string;
  mimeType: string;
  size: number;
  /** Decoded text for CSV / text-PDF / email-body inputs. */
  textContent?: string;
  /** Inbound email subject — used for type hints. */
  subject?: string;
  /** Inbound email sender. */
  from?: string;
}

export interface ParseResult {
  documentType: DocumentType;
  normalized: NormalizedExtraction;
  rawText: string;
  rawJson: ExtractionRawJson;
  confidence: number;
  needsReview: boolean;
  /** Which adapter produced this result. */
  adapter: string;
}

const REVIEW_THRESHOLD = 0.7;

// ----------------------------------------------------------------------------
// Document type auto-detection
// ----------------------------------------------------------------------------
export function detectDocumentType(input: ParseInput): DocumentType {
  const name = `${input.fileName} ${input.subject ?? ""}`.toLowerCase();
  const mime = input.mimeType.toLowerCase();
  if (mime.includes("csv") || name.includes(".csv")) return "bank_statement";
  if (/(uber|bolt|operator|weekly|payout)/.test(name)) return "weekly_statement";
  if (/invoice/.test(name)) return name.includes("sent") ? "invoice_sent" : "invoice_received";
  if (/statement/.test(name)) return "bank_statement";
  if (/mileage/.test(name)) return "mileage_log";
  if (
    /(ncp|parking|barrier|ringgo|justpark|paybyphone|parkopedia|apcoa|appy.?park|pay.?and.?display|ulez|congestion.?charge)/.test(
      name,
    )
  ) {
    return "receipt";
  }
  if (/(screenshot|screen|img_)/.test(name)) return "screenshot";
  if (mime.startsWith("image/")) return "receipt";
  if (mime.includes("pdf")) return "invoice_received";
  return "unknown";
}

// ----------------------------------------------------------------------------
// Work-stream hinting from merchant / source
// ----------------------------------------------------------------------------
const WORK_STREAM_HINTS: Array<[RegExp, WorkStreamCode]> = [
  [/uber|bolt|free now|freenow|ola|phv|private hire|taxi/i, "phv"],
  [/movex|trade ?plate|bca|manheim|collection|delivery driver/i, "trade_plate"],
  [/adobe|figma|canva|dribbble|design/i, "design"],
  [/github|vercel|aws|digitalocean|upwork|fiverr|freelance/i, "freelance"],
];

export function hintWorkStream(text: string): WorkStreamCode | null {
  for (const [re, code] of WORK_STREAM_HINTS) if (re.test(text)) return code;
  return null;
}

// ----------------------------------------------------------------------------
// Category hinting from merchant
// ----------------------------------------------------------------------------
const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/shell|bp|esso|texaco|fuel|petrol|diesel/i, "exp_fuel"],
  [/ncp|car ?park|parking|toll|dartford/i, "exp_parking"],
  [/adobe|figma|github|microsoft|google|software|saas|subscription/i, "exp_software"],
  [/insurance/i, "exp_vehicle_ins"],
  [/tesco|aldi|asda|lidl|sainsbury|morrison/i, "exp_groceries"],
  [/uber|bolt/i, "inc_phv"],
  [/wash|valet|clean/i, "exp_cleaning"],
];

export function hintCategory(text: string): string | null {
  for (const [re, code] of CATEGORY_HINTS) if (re.test(text)) return code;
  return null;
}

// ----------------------------------------------------------------------------
// Adapter 1: receipt photo (mock OCR)
// ----------------------------------------------------------------------------
function parseReceiptImage(input: ParseInput): ParseResult {
  const stem = input.fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  const supplier = guessSupplier(stem);
  const total = pseudoAmount(input.fileName, 6, 95);
  const vat = round2(total - total / 1.2);
  const net = round2(total - vat);
  // Lower confidence for blurry/low-signal names (screenshots, "copy", "img").
  const lowSignal = /(copy|img_|screenshot|scan|photo)/i.test(input.fileName);
  const confidence = lowSignal ? 0.55 : 0.9;

  const normalized: NormalizedExtraction = {
    document_type: "receipt",
    supplier,
    date: todayISO(),
    total,
    net,
    vat_amount: vat,
    vat_rate: 20,
    currency: "GBP",
    direction_hint: "outflow",
    work_stream_hint: hintWorkStream(stem),
    suggested_category_code: hintCategory(stem),
    confidence_breakdown: {
      supplier: confidence,
      total: confidence - 0.05,
      date: confidence - 0.1,
      vat: confidence - 0.15,
    },
  };
  return result("receipt", normalized, mockOcrText(supplier, total, vat), confidence, "receipt-ocr");
}

// ----------------------------------------------------------------------------
// Adapter 2: PDF weekly PHV statement
// ----------------------------------------------------------------------------
function parsePhvStatement(input: ParseInput): ParseResult {
  const text = input.textContent ?? mockPhvStatementText(input.fileName);
  const gross = matchMoney(text, /(gross|total fares|earnings)[^\d]*([\d,]+\.\d{2})/i) ?? 842.16;
  const fees = matchMoney(text, /(service fee|uber fee|commission)[^\d]*([\d,]+\.\d{2})/i) ?? 210.54;
  const net = round2(gross - fees);
  const period = extractPeriod(text);
  const supplier = /bolt/i.test(text) ? "Bolt" : "Uber";

  const normalized: NormalizedExtraction = {
    document_type: "weekly_statement",
    supplier,
    total: gross,
    net,
    currency: "GBP",
    direction_hint: "inflow",
    work_stream_hint: "phv",
    suggested_category_code: "inc_phv",
    statement_period_start: period.start,
    statement_period_end: period.end,
    line_items: [
      { description: "Gross fares", amount: gross },
      { description: "Platform service fee", amount: -fees },
      { description: "Net payout", amount: net },
    ],
    confidence_breakdown: { supplier: 0.98, total: 0.96, period: 0.94 },
  };
  return result("weekly_statement", normalized, text, 0.95, "phv-pdf-parser");
}

// ----------------------------------------------------------------------------
// Adapter 3: CSV bank statement
// ----------------------------------------------------------------------------
function parseBankCsv(input: ParseInput): ParseResult {
  const text = input.textContent ?? mockBankCsv();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return result("bank_statement", { document_type: "bank_statement", transactions: [] }, text, 0.4, "csv-bank-parser");
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const dateIdx = header.findIndex((h) => /date/.test(h));
  const descIdx = header.findIndex((h) => /desc|reference|details|narrative/.test(h));
  const amountIdx = header.findIndex((h) => /amount|value/.test(h));
  const balanceIdx = header.findIndex((h) => /balance/.test(h));

  const transactions = rows.slice(1).filter((r) => r.length >= 2).map((r) => {
    const rawAmount = parseFloat((r[amountIdx] ?? "0").replace(/[£,\s]/g, ""));
    const direction: Direction = rawAmount >= 0 ? "inflow" : "outflow";
    return {
      date: normaliseDate(r[dateIdx] ?? todayISO()),
      description: (r[descIdx] ?? "").trim(),
      amount: Math.abs(rawAmount),
      direction,
      balance: balanceIdx >= 0 ? parseFloat((r[balanceIdx] ?? "").replace(/[£,\s]/g, "")) || null : null,
    };
  });

  const confidence = dateIdx >= 0 && amountIdx >= 0 ? 0.98 : 0.6;
  const normalized: NormalizedExtraction = {
    document_type: "bank_statement",
    currency: "GBP",
    transactions,
    confidence_breakdown: { header_mapping: confidence, row_count: transactions.length ? 0.99 : 0.3 },
  };
  return result("bank_statement", normalized, text, confidence, "csv-bank-parser");
}

// ----------------------------------------------------------------------------
// Top-level dispatcher
// ----------------------------------------------------------------------------
export function processDocument(input: ParseInput): ParseResult {
  const type = detectDocumentType(input);
  switch (type) {
    case "bank_statement":
      if (input.mimeType.includes("csv") || input.fileName.toLowerCase().endsWith(".csv")) {
        return parseBankCsv(input);
      }
      return parseReceiptImage(input);
    case "weekly_statement":
    case "operator_statement":
    case "payout_report":
      return parsePhvStatement(input);
    case "receipt":
    case "screenshot":
      return parseReceiptImage(input);
    case "invoice_received":
    case "invoice_sent":
      return parseReceiptImage({ ...input });
    default:
      return parseReceiptImage(input);
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function result(
  documentType: DocumentType,
  normalized: NormalizedExtraction,
  rawText: string,
  confidence: number,
  adapter: string,
): ParseResult {
  return {
    documentType,
    normalized: { ...normalized, document_type: documentType },
    rawText,
    rawJson: { detected_document_type: documentType, ocr_engine: EXTRACTOR_VERSION, adapter },
    confidence,
    needsReview: confidence < REVIEW_THRESHOLD,
    adapter,
  };
}

function guessSupplier(stem: string): string {
  const known = ["shell", "bp", "esso", "tesco", "aldi", "ncp", "adobe", "amazon", "uber", "bolt"];
  const lower = stem.toLowerCase();
  for (const k of known) if (lower.includes(k)) return k.toUpperCase();
  const first = stem.split(" ")[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "Unknown supplier";
}

function pseudoAmount(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const span = max - min;
  return round2(min + (h % (span * 100)) / 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function matchMoney(text: string, re: RegExp): number | null {
  const m = text.match(re);
  if (!m) return null;
  const last = m[m.length - 1];
  const val = parseFloat(last.replace(/[£,\s]/g, ""));
  return Number.isFinite(val) ? val : null;
}

function extractPeriod(text: string): { start: string | null; end: string | null } {
  const m = text.match(/(\d{4}-\d{2}-\d{2}).{0,8}(\d{4}-\d{2}-\d{2})/);
  if (m) return { start: m[1], end: m[2] };
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 7);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function normaliseDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return todayISO();
}

export function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const out: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQuotes = !inQuotes;
        } else if (ch === "," && !inQuotes) {
          out.push(cur);
          cur = "";
        } else cur += ch;
      }
      out.push(cur);
      return out;
    });
}

// ----------------------------------------------------------------------------
// Mock content generators (stand-ins for real OCR/PDF text)
// ----------------------------------------------------------------------------
function mockOcrText(supplier: string, total: number, vat: number): string {
  return [
    supplier,
    "VAT Reg No 123 4567 89",
    `Date ${todayISO()}`,
    "Item .............. ",
    `Subtotal £${round2(total - vat).toFixed(2)}`,
    `VAT (20%) £${vat.toFixed(2)}`,
    `TOTAL £${total.toFixed(2)}`,
    "Thank you",
  ].join("\n");
}

function mockPhvStatementText(fileName: string): string {
  const supplier = /bolt/i.test(fileName) ? "Bolt" : "Uber";
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return [
    `${supplier} Weekly Earnings Statement`,
    `Period ${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
    "Trips: 96",
    "Gross fares £842.16",
    "Service fee £210.54",
    "Net payout £631.62",
  ].join("\n");
}

export function mockBankCsv(): string {
  return [
    "Date,Description,Amount,Balance",
    "01/06/2026,TESCO STORES 2245,-72.34,1842.55",
    "02/06/2026,NANDOS LONDON,-27.50,1815.05",
    "03/06/2026,UBER BV PAYOUT,842.16,2657.21",
    "04/06/2026,SHELL SERVICE STN,-62.40,2594.81",
    "05/06/2026,EE LIMITED,-35.00,2559.81",
  ].join("\n");
}
