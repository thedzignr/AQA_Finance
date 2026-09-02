import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/data/DataProvider";
import {
  companyDisplayName,
  defaultInvoiceFooter,
  documentTotals,
  lineNet,
  lineVat,
  normaliseLineItems,
} from "@/lib/commerce";
import { COMPANY } from "@/lib/company";
import { companyProfile } from "@/lib/selectors";
import { formatGBP, formatShortDate } from "@/lib/utils";
import type { Invoice, Quote } from "@/types/domain";

export function PrintDocumentPage({ kind }: { kind: "invoice" | "quote" }) {
  const { id } = useParams<{ id: string }>();
  const { data, clientById } = useData();
  const company = companyProfile(data);

  const doc = useMemo(() => {
    if (!id) return null;
    return kind === "invoice"
      ? data.invoices.find((i) => i.id === id) ?? null
      : data.quotes.find((q) => q.id === id) ?? null;
  }, [data.invoices, data.quotes, id, kind]);

  if (!doc) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Document not found.</p>
        <Button asChild variant="link">
          <Link to={kind === "invoice" ? "/invoices" : "/quotes"}>Back</Link>
        </Button>
      </div>
    );
  }

  const client = clientById(doc.client_id);
  const items = normaliseLineItems(doc.line_items);
  const totals = documentTotals(items);
  const invoice = kind === "invoice" ? (doc as Invoice) : null;
  const quote = kind === "quote" ? (doc as Quote) : null;
  const title = kind === "invoice" ? "Invoice" : "Quote";
  const displayName = companyDisplayName(company);

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
        <Button asChild variant="ghost" size="sm">
          <Link to={kind === "invoice" ? "/invoices" : "/quotes"}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      <article className="mx-auto max-w-[800px] bg-white p-8 text-neutral-900 print:max-w-none print:p-0">
        <header className="flex items-start justify-between gap-6 border-b border-neutral-200 pb-6">
          <div>
            <p className="text-xl font-semibold">{displayName}</p>
            {company?.legal_name && company.trading_name && (
              <p className="text-sm text-neutral-600">{company.legal_name}</p>
            )}
            {!company?.legal_name && displayName !== COMPANY.legalName && (
              <p className="text-sm text-neutral-600">{COMPANY.legalName}</p>
            )}
            {company?.registered_address && (
              <p className="mt-2 whitespace-pre-line text-sm text-neutral-600">
                {company.registered_address}
              </p>
            )}
            <div className="mt-2 space-y-0.5 text-sm text-neutral-600">
              {company?.email && <p>{company.email}</p>}
              {company?.phone && <p>{company.phone}</p>}
              <p>Company no. {company?.company_number || COMPANY.companyNumber}</p>
              {company?.vat_registered && company.vat_number && <p>VAT {company.vat_number}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight">{title}</p>
            <p className="mt-1 text-lg font-medium">{doc.number}</p>
            <p className="mt-3 text-sm text-neutral-600">Issued {formatShortDate(doc.issue_date)}</p>
            {invoice?.due_date && (
              <p className="text-sm text-neutral-600">Due {formatShortDate(invoice.due_date)}</p>
            )}
            {quote?.valid_until && (
              <p className="text-sm text-neutral-600">Valid until {formatShortDate(quote.valid_until)}</p>
            )}
          </div>
        </header>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Bill to</p>
            <p className="mt-1 font-medium">{client?.name ?? "—"}</p>
            {client?.contact_name && <p className="text-sm">{client.contact_name}</p>}
            {client?.address && (
              <p className="whitespace-pre-line text-sm text-neutral-600">{client.address}</p>
            )}
            {client?.email && <p className="text-sm text-neutral-600">{client.email}</p>}
            {client?.vat_number && <p className="text-sm text-neutral-600">VAT {client.vat_number}</p>}
          </div>
        </section>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 font-medium">Unit</th>
              <th className="py-2 text-right font-medium">Price</th>
              {company?.vat_registered && <th className="py-2 text-right font-medium">VAT</th>}
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-100">
                <td className="py-2">{item.description || "—"}</td>
                <td className="py-2 text-right tnum">{item.quantity}</td>
                <td className="py-2 capitalize">{item.unit}</td>
                <td className="py-2 text-right tnum">{formatGBP(item.unit_price)}</td>
                {company?.vat_registered && (
                  <td className="py-2 text-right tnum">{item.vat_rate}%</td>
                )}
                <td className="py-2 text-right tnum">
                  {formatGBP(company?.vat_registered ? lineNet(item) + lineVat(item) : lineNet(item))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 ml-auto w-64 space-y-1 text-sm">
          <Row label="Net" value={totals.net} />
          {company?.vat_registered && <Row label="VAT" value={totals.vat} />}
          <Row label="Total" value={totals.gross} bold />
          {invoice && Number(invoice.paid_amount) > 0 && (
            <>
              <Row label="Paid" value={Number(invoice.paid_amount)} />
              <Row
                label="Balance due"
                value={totals.gross - Number(invoice.paid_amount)}
                bold
              />
            </>
          )}
        </div>

        {doc.notes && (
          <section className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Notes</p>
            <p className="mt-1 whitespace-pre-line text-sm">{doc.notes}</p>
          </section>
        )}

        {kind === "invoice" && (company?.bank_account_number || company?.bank_name) && (
          <section className="mt-8 rounded-md border border-neutral-200 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Payment details
            </p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {company.bank_account_name && <p>Name: {company.bank_account_name}</p>}
              {company.bank_name && <p>Bank: {company.bank_name}</p>}
              {company.bank_sort_code && <p>Sort code: {company.bank_sort_code}</p>}
              {company.bank_account_number && <p>Account: {company.bank_account_number}</p>}
            </div>
          </section>
        )}

        {doc.terms && (
          <p className="mt-6 text-xs text-neutral-600 whitespace-pre-line">{doc.terms}</p>
        )}

        <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          {defaultInvoiceFooter(company)}
        </footer>
      </article>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "border-t border-neutral-300 pt-1 font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tnum">{formatGBP(value)}</span>
    </div>
  );
}
