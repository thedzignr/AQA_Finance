import { useMemo, useState } from "react";
import { FileSpreadsheet, MoreHorizontal, Plus, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { InvoiceStatusBadge } from "@/components/shared/StatusBadges";
import { SalesDocumentDialog } from "@/components/commerce/SalesDocumentDialog";
import { useData } from "@/data/DataProvider";
import { useAuth } from "@/data/auth";
import { salesSummary } from "@/lib/selectors";
import { invoiceBalance, invoiceDisplayStatus } from "@/lib/commerce";
import { formatGBP, formatShortDate, newId, todayISO } from "@/lib/utils";
import type { Invoice, Transaction } from "@/types/domain";

export function InvoicesPage() {
  const { data, insert, update, remove, clientById, categoryByCode } = useData();
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const sales = useMemo(() => salesSummary(data), [data]);

  const invoices = useMemo(
    () => [...data.invoices].sort((a, b) => b.issue_date.localeCompare(a.issue_date)),
    [data.invoices],
  );

  async function setStatus(invoice: Invoice, status: Invoice["status"]) {
    await update("invoices", invoice.id, {
      status,
      updated_at: new Date().toISOString(),
    });
  }

  async function recordPayment(
    invoice: Invoice,
    amount: number,
    date: string,
    accountId: string | null,
  ) {
    if (!userId) return;
    const paidSoFar = Number(invoice.paid_amount) || 0;
    const nextPaid = paidSoFar + amount;
    const gross = Number(invoice.gross_amount) || 0;
    const fullyPaid = nextPaid >= gross - 0.005;
    const now = new Date().toISOString();

    const client = clientById(invoice.client_id);
    const category = categoryByCode("inc_invoice") ?? data.categories.find((c) => c.kind === "income");
    const txn: Transaction = {
      id: newId(),
      user_id: userId,
      account_id: accountId,
      work_stream_id: invoice.work_stream_id,
      category_id: category?.id ?? null,
      transaction_date: date,
      posted_date: date,
      kind: "income",
      ownership_type: "business",
      counterparty: client?.name ?? null,
      description: `Invoice ${invoice.number}`,
      amount,
      direction: "inflow",
      currency: "GBP",
      business_use_pct: 100,
      tax_relevant: true,
      recurring_rule_id: null,
      linked_document_id: null,
      linked_bill_id: null,
      linked_debt_id: null,
      transfer_group_id: null,
      reconciliation_status: "unreconciled",
      review_status: "none",
      notes: `Payment against ${invoice.number}`,
      created_at: now,
      updated_at: now,
    };
    await insert("transactions", txn);
    await update("invoices", invoice.id, {
      paid_amount: nextPaid,
      paid_date: fullyPaid ? date : invoice.paid_date ?? date,
      status: fullyPaid ? "paid" : "part_paid",
      linked_transaction_id: txn.id,
      updated_at: now,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        icon={FileSpreadsheet}
        description="Issue invoices, chase what's overdue, and post payment into the ledger when it lands."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New invoice
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Outstanding" value={formatGBP(sales.outstanding)} accent="primary" icon={FileSpreadsheet} />
        <StatCard
          label="Overdue"
          value={formatGBP(sales.overdue)}
          hint={sales.overdueCount ? `${sales.overdueCount} invoice${sales.overdueCount === 1 ? "" : "s"}` : "None"}
          accent="destructive"
        />
        <StatCard label="Paid this month" value={formatGBP(sales.paidThisMonth)} accent="success" />
        <StatCard label="Drafts" value={String(sales.draftCount)} />
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No invoices yet"
          description="Invoice design and freelance work, or convert an accepted quote. Mark paid to post income to the ledger."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New invoice
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
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const display = invoiceDisplayStatus(inv);
                  const due = invoiceBalance(inv);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.number}</TableCell>
                      <TableCell>{clientById(inv.client_id)?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatShortDate(inv.issue_date)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatShortDate(inv.due_date)}</TableCell>
                      <TableCell>
                        <InvoiceStatusBadge value={display} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={Number(inv.gross_amount) || 0} />
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.status === "paid" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Money value={due} />
                        )}
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
                                setEditing(inv);
                                setOpen(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/print/invoice/${inv.id}`}>
                                <Printer className="h-4 w-4" /> Print / PDF
                              </Link>
                            </DropdownMenuItem>
                            {inv.status === "draft" && (
                              <DropdownMenuItem onClick={() => void setStatus(inv, "sent")}>
                                Mark sent
                              </DropdownMenuItem>
                            )}
                            {inv.status !== "paid" && inv.status !== "void" && (
                              <DropdownMenuItem onClick={() => setPaying(inv)}>
                                Record payment
                              </DropdownMenuItem>
                            )}
                            {inv.status !== "void" && inv.status !== "paid" && (
                              <DropdownMenuItem onClick={() => void setStatus(inv, "void")}>
                                Void
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => void remove("invoices", inv.id)}
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
        kind="invoice"
        open={open}
        onOpenChange={setOpen}
        document={editing}
      />
      <MarkPaidDialog
        invoice={paying}
        onOpenChange={(o) => {
          if (!o) setPaying(null);
        }}
        onConfirm={(amount, date, accountId) => {
          if (paying) void recordPayment(paying, amount, date, accountId);
          setPaying(null);
        }}
      />
    </div>
  );
}

function MarkPaidDialog({
  invoice,
  onOpenChange,
  onConfirm,
}: {
  invoice: Invoice | null;
  onOpenChange: (o: boolean) => void;
  onConfirm: (amount: number, date: string, accountId: string | null) => void;
}) {
  const { data } = useData();
  const remaining = invoice ? invoiceBalance(invoice) : 0;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState(data.accounts[0]?.id ?? "none");
  const [seeded, setSeeded] = useState<string | null>(null);

  if (invoice && seeded !== invoice.id) {
    setSeeded(invoice.id);
    setAmount(String(remaining));
    setDate(todayISO());
    setAccountId(data.accounts.find((a) => a.account_type === "current")?.id ?? data.accounts[0]?.id ?? "none");
  }

  return (
    <Dialog
      open={Boolean(invoice)}
      onOpenChange={(o) => {
        if (!o) setSeeded(null);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment {invoice ? `· ${invoice.number}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Remaining {formatGBP(remaining)}. This posts a business income line on the ledger.
          </p>
          <div className="space-y-1.5">
            <Label>Amount (£)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Paid on</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No account</SelectItem>
                {data.accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm(
                parseFloat(amount) || 0,
                date,
                accountId === "none" ? null : accountId,
              )
            }
            disabled={!invoice || !(parseFloat(amount) > 0)}
          >
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
