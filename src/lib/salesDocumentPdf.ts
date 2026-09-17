import {
  companyDisplayName,
  defaultInvoiceFooter,
  documentTotals,
  lineNet,
  lineVat,
  normaliseLineItems,
} from "@/lib/commerce";
import { COMPANY } from "@/lib/company";
import { formatGBP, formatShortDate } from "@/lib/utils";
import type { Client, CompanyProfile, Invoice, Quote } from "@/types/domain";

type JsPdf = import("jspdf").jsPDF;

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 18;
const BODY = 9;
const SMALL = 8;
const LINE = 4.4;

const INK: [number, number, number] = [23, 23, 23];
const MUTED: [number, number, number] = [82, 82, 82];
const RULE: [number, number, number] = [212, 212, 212];

export function salesDocumentPdfFilename(number: string): string {
  const stem = number
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\.+$/, "")
    .trim();
  return `${stem || "document"}.pdf`;
}

export async function downloadSalesDocumentPdf(opts: {
  kind: "invoice" | "quote";
  doc: Invoice | Quote;
  client: Client | null | undefined;
  company: CompanyProfile | null | undefined;
}): Promise<void> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const pdf = new JsPDF({ unit: "mm", format: "a4" });
  renderSalesDocument(pdf, opts);
  pdf.save(salesDocumentPdfFilename(opts.doc.number));
}

function money(n: number): string {
  return formatGBP(n).replace(/\u00a0/g, " ");
}

function renderSalesDocument(
  pdf: JsPdf,
  {
    kind,
    doc,
    client,
    company,
  }: {
    kind: "invoice" | "quote";
    doc: Invoice | Quote;
    client: Client | null | undefined;
    company: CompanyProfile | null | undefined;
  },
) {
  const items = normaliseLineItems(doc.line_items);
  const totals = documentTotals(items);
  const invoice = kind === "invoice" ? (doc as Invoice) : null;
  const quote = kind === "quote" ? (doc as Quote) : null;
  const vatOn = Boolean(company?.vat_registered);
  const displayName = companyDisplayName(company);

  let y = MARGIN;
  pdf.setFont("helvetica", "normal");

  const ensure = (h: number) => {
    if (y + h <= BOTTOM) return;
    pdf.addPage();
    y = MARGIN;
  };

  const setInk = () => pdf.setTextColor(...INK);
  const setMuted = () => pdf.setTextColor(...MUTED);

  const write = (
    text: string,
    x: number,
    opts?: { size?: number; color?: "ink" | "muted"; align?: "left" | "right"; bold?: boolean },
  ) => {
    pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
    pdf.setFontSize(opts?.size ?? BODY);
    if (opts?.color === "muted") setMuted();
    else setInk();
    pdf.text(text, x, y, { align: opts?.align ?? "left" });
  };

  const wrap = (text: string, width: number, size = BODY) => {
    pdf.setFontSize(size);
    return text
      .split(/\r?\n/)
      .flatMap((line) => pdf.splitTextToSize(line.length ? line : " ", width) as string[]);
  };

  const writeLines = (
    lines: string[],
    x: number,
    opts?: { size?: number; color?: "ink" | "muted"; bold?: boolean; gap?: number },
  ) => {
    const gap = opts?.gap ?? LINE;
    for (const line of lines) {
      ensure(gap);
      write(line, x, opts);
      y += gap;
    }
  };

  const headerLines: string[] = [displayName];
  if (company?.legal_name && company.trading_name) headerLines.push(company.legal_name);
  else if (!company?.legal_name && displayName !== COMPANY.legalName) {
    headerLines.push(COMPANY.legalName);
  }
  const addressLines = company?.registered_address
    ? wrap(company.registered_address, 100, SMALL)
    : [];
  const metaLines = [
    company?.email,
    company?.phone,
    `Company no. ${company?.company_number || COMPANY.companyNumber}`,
    company?.vat_registered && company.vat_number ? `VAT ${company.vat_number}` : null,
  ].filter((v): v is string => Boolean(v));

  const leftBlock = [
    ...headerLines,
    ...addressLines,
    ...metaLines,
  ];
  const rightTitle = kind === "invoice" ? "Invoice" : "Quote";
  const rightMeta = [
    `Issued ${formatShortDate(doc.issue_date)}`,
    invoice?.due_date ? `Due ${formatShortDate(invoice.due_date)}` : null,
    quote?.valid_until ? `Valid until ${formatShortDate(quote.valid_until)}` : null,
  ].filter((v): v is string => Boolean(v));

  const headerH = Math.max(
    leftBlock.length * LINE + 6,
    14 + LINE + rightMeta.length * LINE,
  );
  ensure(headerH);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  setInk();
  pdf.text(displayName, MARGIN, y);
  pdf.setFontSize(18);
  pdf.text(rightTitle, PAGE_W - MARGIN, y, { align: "right" });
  y += 7;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(SMALL);
  setMuted();
  const extraCompany = headerLines.slice(1);
  let ly = y;
  for (const line of extraCompany) {
    pdf.text(line, MARGIN, ly);
    ly += LINE;
  }
  if (addressLines.length) {
    ly += 1;
    for (const line of addressLines) {
      pdf.text(line, MARGIN, ly);
      ly += LINE;
    }
  }
  ly += 1;
  for (const line of metaLines) {
    pdf.text(line, MARGIN, ly);
    ly += LINE;
  }

  let ry = y;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  setInk();
  pdf.text(doc.number, PAGE_W - MARGIN, ry, { align: "right" });
  ry += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(SMALL);
  setMuted();
  for (const line of rightMeta) {
    pdf.text(line, PAGE_W - MARGIN, ry, { align: "right" });
    ry += LINE;
  }

  y = Math.max(ly, ry) + 4;
  pdf.setDrawColor(...RULE);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  ensure(18);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(120, 120, 120);
  pdf.text("BILL TO", MARGIN, y);
  y += 5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(BODY);
  setInk();

  const companyName = client?.company_name?.trim();
  const personName = client?.name?.trim();
  if (companyName) {
    write(companyName, MARGIN, { bold: true });
    y += LINE;
    if (personName && personName !== companyName) {
      write(personName, MARGIN, { size: SMALL });
      y += LINE;
    }
  } else {
    write(personName || "—", MARGIN, { bold: true });
    y += LINE;
  }
  pdf.setFont("helvetica", "normal");
  const billBits: string[] = [];
  if (client?.address) billBits.push(...wrap(client.address, 100, SMALL));
  if (client?.email) billBits.push(client.email);
  if (client?.vat_number) billBits.push(`VAT ${client.vat_number}`);
  writeLines(billBits, MARGIN, { size: SMALL, color: "muted" });
  y += 4;

  const amountW = 28;
  const priceW = 26;
  const vatW = vatOn ? 18 : 0;
  const unitW = 18;
  const qtyW = 16;
  const descW = CONTENT_W - amountW - priceW - vatW - unitW - qtyW;
  const qtyX = MARGIN + descW;
  const unitX = qtyX + qtyW;
  const priceX = unitX + unitW;
  const vatX = priceX + priceW;
  const amountX = PAGE_W - MARGIN;

  const drawTableHead = () => {
    ensure(10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text("DESCRIPTION", MARGIN, y);
    pdf.text("QTY", qtyX + qtyW, y, { align: "right" });
    pdf.text("UNIT", unitX, y);
    pdf.text("PRICE", priceX + priceW, y, { align: "right" });
    if (vatOn) pdf.text("VAT", vatX + vatW, y, { align: "right" });
    pdf.text("AMOUNT", amountX, y, { align: "right" });
    y += 2;
    pdf.setDrawColor(...RULE);
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  };

  drawTableHead();

  for (const item of items) {
    const descLines = wrap(item.description || "—", descW - 2, SMALL);
    const rowH = Math.max(LINE + 2, descLines.length * 3.8 + 2);
    if (y + rowH > BOTTOM) {
      pdf.addPage();
      y = MARGIN;
      drawTableHead();
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(SMALL);
    setInk();
    let dy = y;
    for (const line of descLines) {
      pdf.text(line, MARGIN, dy);
      dy += 3.8;
    }
    const baseline = y;
    pdf.text(String(item.quantity), qtyX + qtyW, baseline, { align: "right" });
    pdf.text(item.unit, unitX, baseline);
    pdf.text(money(item.unit_price), priceX + priceW, baseline, { align: "right" });
    if (vatOn) {
      pdf.text(`${item.vat_rate}%`, vatX + vatW, baseline, { align: "right" });
    }
    const amount = vatOn ? lineNet(item) + lineVat(item) : lineNet(item);
    pdf.text(money(amount), amountX, baseline, { align: "right" });
    y += rowH;
    pdf.setDrawColor(245, 245, 245);
    pdf.line(MARGIN, y - 1.5, PAGE_W - MARGIN, y - 1.5);
  }

  y += 4;
  const totalsX = PAGE_W - MARGIN - 64;
  const totalsRows: { label: string; value: number; bold?: boolean }[] = [
    { label: "Net", value: totals.net },
  ];
  if (vatOn) totalsRows.push({ label: "VAT", value: totals.vat });
  totalsRows.push({ label: "Total", value: totals.gross, bold: true });
  if (invoice && Number(invoice.paid_amount) > 0) {
    totalsRows.push({ label: "Paid", value: Number(invoice.paid_amount) });
    totalsRows.push({
      label: "Balance due",
      value: totals.gross - Number(invoice.paid_amount),
      bold: true,
    });
  }

  ensure(totalsRows.length * 6 + 4);
  for (const row of totalsRows) {
    if (row.bold) {
      pdf.setDrawColor(...RULE);
      pdf.line(totalsX, y - 3.5, PAGE_W - MARGIN, y - 3.5);
    }
    pdf.setFont("helvetica", row.bold ? "bold" : "normal");
    pdf.setFontSize(BODY);
    setInk();
    pdf.text(row.label, totalsX, y);
    pdf.text(money(row.value), amountX, y, { align: "right" });
    y += 6;
  }

  if (doc.notes?.trim()) {
    y += 4;
    ensure(12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text("NOTES", MARGIN, y);
    y += 5;
    writeLines(wrap(doc.notes.trim(), CONTENT_W, SMALL), MARGIN, { size: SMALL });
  }

  if (kind === "invoice" && (company?.bank_account_number || company?.bank_name)) {
    y += 6;
    const bankLines = [
      company.bank_account_name ? `Name: ${company.bank_account_name}` : null,
      company.bank_name ? `Bank: ${company.bank_name}` : null,
      company.bank_sort_code ? `Sort code: ${company.bank_sort_code}` : null,
      company.bank_account_number ? `Account: ${company.bank_account_number}` : null,
    ].filter((v): v is string => Boolean(v));
    const boxH = 10 + Math.ceil(bankLines.length / 2) * LINE;
    ensure(boxH + 4);
    pdf.setDrawColor(...RULE);
    pdf.rect(MARGIN, y, CONTENT_W, boxH);
    y += 6;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text("PAYMENT DETAILS", MARGIN + 4, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(SMALL);
    setInk();
    const col2 = MARGIN + CONTENT_W / 2;
    bankLines.forEach((line, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      pdf.text(line, (col === 0 ? MARGIN : col2) + 4, y + row * LINE);
    });
    y += Math.ceil(bankLines.length / 2) * LINE + 4;
  }

  if (doc.terms?.trim()) {
    y += 4;
    writeLines(wrap(doc.terms.trim(), CONTENT_W, 7), MARGIN, {
      size: 7,
      color: "muted",
      gap: 3.6,
    });
  }

  y += 8;
  ensure(10);
  pdf.setDrawColor(...RULE);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;
  writeLines(wrap(defaultInvoiceFooter(company), CONTENT_W, 7), MARGIN, {
    size: 7,
    color: "muted",
    gap: 3.6,
  });
}
