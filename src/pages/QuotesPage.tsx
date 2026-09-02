import { useMemo, useState } from "react";
import { FileSignature, MoreHorizontal, Plus, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { QuoteStatusBadge } from "@/components/shared/StatusBadges";
import { SalesDocumentDialog } from "@/components/commerce/SalesDocumentDialog";
import { useData } from "@/data/DataProvider";
import { salesSummary } from "@/lib/selectors";
import { normaliseLineItems, quoteDisplayStatus } from "@/lib/commerce";
import { formatGBP, formatShortDate } from "@/lib/utils";
import type { Invoice, Quote, QuoteStatus } from "@/types/domain";

export function QuotesPage() {
  const { data, update, remove, clientById } = useData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [convert, setConvert] = useState<Quote | null>(null);
  const sales = useMemo(() => salesSummary(data), [data]);

  const quotes = useMemo(
    () =>
      [...data.quotes].sort((a, b) => b.issue_date.localeCompare(a.issue_date)),
    [data.quotes],
  );

  async function setStatus(quote: Quote, status: QuoteStatus) {
    await update("quotes", quote.id, {
      status,
      updated_at: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        icon={FileSignature}
        description="Price the work, send it, then convert accepted quotes into invoices in one step."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New quote
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Open quotes" value={String(sales.quotesAwaiting)} icon={FileSignature} />
        <StatCard label="Pipeline" value={formatGBP(sales.quotePipeline)} accent="primary" />
        <StatCard
          label="Accepted / converted"
          value={String(data.quotes.filter((q) => q.status === "accepted" || q.status === "converted").length)}
          accent="success"
        />
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="No quotes yet"
          description="Create a quote for design or freelance work. When it's accepted, convert it to an invoice."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New quote
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Valid until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((q) => {
                  const status = quoteDisplayStatus(q);
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.number}</TableCell>
                      <TableCell>{clientById(q.client_id)?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatShortDate(q.issue_date)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatShortDate(q.valid_until)}</TableCell>
                      <TableCell>
                        <QuoteStatusBadge value={status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={Number(q.gross_amount) || 0} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(q);
                                setOpen(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/print/quote/${q.id}`}>
                                <Printer className="h-4 w-4" /> Print / PDF
                              </Link>
                            </DropdownMenuItem>
                            {q.status === "draft" && (
                              <DropdownMenuItem onClick={() => void setStatus(q, "sent")}>
                                Mark sent
                              </DropdownMenuItem>
                            )}
                            {(q.status === "sent" || q.status === "draft") && (
                              <DropdownMenuItem onClick={() => void setStatus(q, "accepted")}>
                                Mark accepted
                              </DropdownMenuItem>
                            )}
                            {(q.status === "sent" || q.status === "accepted") && (
                              <DropdownMenuItem onClick={() => setConvert(q)}>
                                Convert to invoice
                              </DropdownMenuItem>
                            )}
                            {q.status !== "converted" && q.status !== "declined" && (
                              <DropdownMenuItem onClick={() => void setStatus(q, "declined")}>
                                Mark declined
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => void remove("quotes", q.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <SalesDocumentDialog
        kind="quote"
        open={open}
        onOpenChange={setOpen}
        document={editing}
      />
      <SalesDocumentDialog
        kind="invoice"
        open={Boolean(convert)}
        onOpenChange={(o) => {
          if (!o) setConvert(null);
        }}
        defaults={
          convert
            ? {
                client_id: convert.client_id,
                work_stream_id: convert.work_stream_id,
                line_items: normaliseLineItems(convert.line_items),
                quote_id: convert.id,
                notes: convert.notes,
              }
            : undefined
        }
        onSaved={(doc) => {
          if (!convert) return;
          const inv = doc as Invoice;
          void update("quotes", convert.id, {
            status: "converted",
            converted_invoice_id: inv.id,
            updated_at: new Date().toISOString(),
          });
          setConvert(null);
        }}
      />
    </div>
  );
}
