import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LineItemsEditor } from "./LineItemsEditor";
import { useData } from "@/data/DataProvider";
import { useAuth } from "@/data/auth";
import type { DocumentLineItem, Invoice, Quote } from "@/types/domain";
import {
  DEFAULT_INVOICE_TERMS,
  DEFAULT_QUOTE_TERMS,
  documentTotals,
  emptyLineItem,
  formatDocNumber,
  normaliseLineItems,
  paymentTermsDays,
} from "@/lib/commerce";
import { addDaysISO, newId, todayISO } from "@/lib/utils";
import { companyProfile } from "@/lib/selectors";

export interface SalesDocumentDefaults {
  client_id?: string | null;
  work_stream_id?: string | null;
  line_items?: DocumentLineItem[];
  quote_id?: string | null;
  notes?: string | null;
}

export function SalesDocumentDialog({
  kind,
  open,
  onOpenChange,
  document,
  defaults,
  onSaved,
}: {
  kind: "quote" | "invoice";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: Quote | Invoice | null;
  defaults?: SalesDocumentDefaults;
  onSaved?: (doc: Quote | Invoice) => void;
}) {
  const { data, insert, update } = useData();
  const { userId } = useAuth();
  const company = companyProfile(data);
  const isEdit = Boolean(document);
  const vatRate = company?.vat_registered ? Number(company.default_vat_rate) || 20 : 0;
  const showVat = Boolean(company?.vat_registered);

  const [clientId, setClientId] = useState<string>("none");
  const [workStreamId, setWorkStreamId] = useState<string>("none");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [validUntil, setValidUntil] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<DocumentLineItem[]>([emptyLineItem(vatRate)]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clients = useMemo(
    () => data.clients.filter((c) => c.active || c.id === document?.client_id),
    [data.clients, document?.client_id],
  );

  useEffect(() => {
    if (!open) return;
    const existingItems = document
      ? normaliseLineItems(document.line_items)
      : defaults?.line_items?.length
        ? defaults.line_items
        : [emptyLineItem(vatRate)];
    const client = document?.client_id ?? defaults?.client_id ?? "none";
    const issue = document?.issue_date ?? todayISO();
    setClientId(client || "none");
    setWorkStreamId(document?.work_stream_id ?? defaults?.work_stream_id ?? "none");
    setIssueDate(issue);
    setItems(existingItems.length ? existingItems : [emptyLineItem(vatRate)]);
    setNotes(document?.notes ?? defaults?.notes ?? "");
    setError(null);

    if (kind === "quote") {
      const q = document as Quote | null | undefined;
      setValidUntil(
        q?.valid_until ??
          addDaysISO(issue, company?.default_quote_valid_days ?? 30),
      );
      setTerms(q?.terms ?? DEFAULT_QUOTE_TERMS);
    } else {
      const inv = document as Invoice | null | undefined;
      const clientRow = data.clients.find((c) => c.id === (client === "none" ? null : client));
      setDueDate(
        inv?.due_date ??
          addDaysISO(issue, paymentTermsDays(company, clientRow?.payment_terms_days)),
      );
      setTerms(inv?.terms ?? DEFAULT_INVOICE_TERMS);
    }
    // Seed once when the dialog opens so live typing isn't reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onClientChange(id: string) {
    setClientId(id);
    const client = data.clients.find((c) => c.id === id);
    if (client?.default_work_stream_id) setWorkStreamId(client.default_work_stream_id);
    if (kind === "invoice" && !isEdit) {
      setDueDate(addDaysISO(issueDate, paymentTermsDays(company, client?.payment_terms_days)));
    }
  }

  async function allocateNumber(type: "quote" | "invoice"): Promise<string> {
    if (!company) {
      const seq = type === "quote" ? data.quotes.length + 1 : data.invoices.length + 1;
      return formatDocNumber(type === "quote" ? "QTE" : "INV", seq);
    }
    if (type === "quote") {
      const number = formatDocNumber(company.quote_prefix, company.next_quote_number);
      await update("companyProfiles", company.id, {
        next_quote_number: Number(company.next_quote_number) + 1,
        updated_at: new Date().toISOString(),
      });
      return number;
    }
    const number = formatDocNumber(company.invoice_prefix, company.next_invoice_number);
    await update("companyProfiles", company.id, {
      next_invoice_number: Number(company.next_invoice_number) + 1,
      updated_at: new Date().toISOString(),
    });
    return number;
  }

  async function save() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const totals = documentTotals(items);
    const amounts = {
      net_amount: totals.net,
      vat_amount: totals.vat,
      gross_amount: totals.gross,
    };
    const now = new Date().toISOString();
    const cid = clientId === "none" ? null : clientId;
    const wsid = workStreamId === "none" ? null : workStreamId;
    try {
      let saved: Quote | Invoice | null = null;
      if (kind === "quote") {
        if (isEdit && document) {
          const patch: Partial<Quote> = {
            client_id: cid,
            work_stream_id: wsid,
            issue_date: issueDate,
            valid_until: validUntil || null,
            line_items: items,
            notes: notes || null,
            terms: terms || null,
            ...amounts,
            updated_at: now,
          };
          await update("quotes", document.id, patch);
          saved = { ...(document as Quote), ...patch };
        } else {
          const row: Quote = {
            id: newId(),
            user_id: userId,
            client_id: cid,
            work_stream_id: wsid,
            number: await allocateNumber("quote"),
            status: "draft",
            issue_date: issueDate,
            valid_until: validUntil || null,
            line_items: items,
            notes: notes || null,
            terms: terms || null,
            ...amounts,
            converted_invoice_id: null,
            created_at: now,
            updated_at: now,
          };
          saved = await insert("quotes", row);
        }
      } else {
        const quoteId =
          defaults?.quote_id ??
          (document && "quote_id" in document ? document.quote_id : null);
        if (isEdit && document) {
          const patch: Partial<Invoice> = {
            client_id: cid,
            work_stream_id: wsid,
            issue_date: issueDate,
            due_date: dueDate || null,
            line_items: items,
            notes: notes || null,
            terms: terms || null,
            ...amounts,
            updated_at: now,
          };
          await update("invoices", document.id, patch);
          saved = { ...(document as Invoice), ...patch };
        } else {
          const row: Invoice = {
            id: newId(),
            user_id: userId,
            client_id: cid,
            work_stream_id: wsid,
            quote_id: quoteId ?? null,
            number: await allocateNumber("invoice"),
            status: "draft",
            issue_date: issueDate,
            due_date: dueDate || null,
            paid_date: null,
            paid_amount: 0,
            line_items: items,
            notes: notes || null,
            terms: terms || null,
            ...amounts,
            linked_transaction_id: null,
            created_at: now,
            updated_at: now,
          };
          saved = await insert("invoices", row);
        }
      }
      if (saved) onSaved?.(saved);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${kind}` : `New ${kind}`}
          </DialogTitle>
          <DialogDescription>
            {kind === "quote"
              ? "Send a quote, then convert it to an invoice when the client accepts."
              : "Draft an invoice. Mark it sent when you issue it, then paid when the money lands."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={onClientChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No client</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Work stream</Label>
            <Select value={workStreamId} onValueChange={setWorkStreamId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {data.workStreams.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Issue date</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          {kind === "quote" ? (
            <div className="space-y-1.5">
              <Label>Valid until</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Line items</Label>
          <LineItemsEditor
            items={items}
            onChange={setItems}
            defaultVatRate={vatRate}
            showVat={showVat}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Notes (shown on the {kind})</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label>Terms</Label>
            <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {isEdit ? "Save changes" : `Save ${kind}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
