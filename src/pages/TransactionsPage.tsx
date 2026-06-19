import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Tags, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/PageHeader";
import { Money } from "@/components/shared/Money";
import { OwnershipBadge } from "@/components/shared/StatusBadges";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { useData } from "@/data/DataProvider";
import type { OwnershipType, Transaction } from "@/types/domain";
import { formatGBP } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

export function TransactionsPage() {
  const { data, categoryById, workStreamById, accountById, update, remove } = useData();

  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [workStreamFilter, setWorkStreamFilter] = useState("all");
  const [ownershipFilter, setOwnershipFilter] = useState("all");
  const [taxFilter, setTaxFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.transactions
      .filter((t) => {
        if (q && !`${t.description} ${t.counterparty ?? ""}`.toLowerCase().includes(q)) return false;
        if (accountFilter !== "all" && t.account_id !== accountFilter) return false;
        if (categoryFilter !== "all" && t.category_id !== categoryFilter) return false;
        if (workStreamFilter !== "all") {
          if (workStreamFilter === "none" ? t.work_stream_id !== null : t.work_stream_id !== workStreamFilter)
            return false;
        }
        if (ownershipFilter !== "all" && t.ownership_type !== ownershipFilter) return false;
        if (taxFilter === "tax" && !t.tax_relevant) return false;
        if (taxFilter === "non_tax" && t.tax_relevant) return false;
        if (fromDate && t.transaction_date < fromDate) return false;
        if (toDate && t.transaction_date > toDate) return false;
        return true;
      })
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  }, [
    data.transactions,
    search,
    accountFilter,
    categoryFilter,
    workStreamFilter,
    ownershipFilter,
    taxFilter,
    fromDate,
    toDate,
  ]);

  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const t of filtered) {
      if (t.direction === "inflow") inflow += t.amount;
      else outflow += t.amount;
    }
    return { inflow, outflow, net: inflow - outflow };
  }, [filtered]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id)),
    );
  }

  async function bulkUpdate(patch: Partial<Transaction>) {
    for (const id of selected) {
      await update("transactions", id, patch);
    }
    setSelected(new Set());
  }

  const hasFilters =
    search || accountFilter !== "all" || categoryFilter !== "all" ||
    workStreamFilter !== "all" || ownershipFilter !== "all" || taxFilter !== "all" ||
    fromDate || toDate;

  function clearFilters() {
    setSearch("");
    setAccountFilter("all");
    setCategoryFilter("all");
    setWorkStreamFilter("all");
    setOwnershipFilter("all");
    setTaxFilter("all");
    setFromDate("");
    setToDate("");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transactions"
        description="One unified ledger for every money movement across all accounts and work streams."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add transaction
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative md:col-span-2 lg:col-span-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description or merchant…"
                className="pl-8"
              />
            </div>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {data.accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={workStreamFilter} onValueChange={setWorkStreamFilter}>
              <SelectTrigger><SelectValue placeholder="Work stream" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All work streams</SelectItem>
                <SelectItem value="none">Unassigned</SelectItem>
                {data.workStreams.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {[...data.categories]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
              <SelectTrigger><SelectValue placeholder="Ownership" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ownership</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={taxFilter} onValueChange={setTaxFilter}>
              <SelectTrigger><SelectValue placeholder="Tax" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="tax">Tax relevant</SelectItem>
                <SelectItem value="non_tax">Not tax relevant</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">{filtered.length} results</span>
            <Badge variant="success">In {formatGBP(totals.inflow)}</Badge>
            <Badge variant="destructive">Out {formatGBP(totals.outflow)}</Badge>
            <Badge variant="muted">Net {formatGBP(totals.net)}</Badge>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent/40 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Tags className="h-3.5 w-3.5" /> Set category
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-72 overflow-y-auto">
              <DropdownMenuLabel>Apply category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[...data.categories]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => void bulkUpdate({ category_id: c.id })}>
                    {c.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Work stream</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => void bulkUpdate({ work_stream_id: null })}>
                Unassigned
              </DropdownMenuItem>
              {data.workStreams.map((w) => (
                <DropdownMenuItem key={w.id} onClick={() => void bulkUpdate({ work_stream_id: w.id })}>
                  {w.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Ownership</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {(["personal", "business", "mixed"] as OwnershipType[]).map((o) => (
                <DropdownMenuItem key={o} className="capitalize" onClick={() => void bulkUpdate({ ownership_type: o })}>
                  {o}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => void bulkUpdate({ tax_relevant: true })}>
            Mark tax relevant
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            <X className="h-3.5 w-3.5" /> Clear selection
          </Button>
        </div>
      )}

      {/* Ledger table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9">
                  <Checkbox
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Work stream</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Ownership</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-9" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} data-state={selected.has(t.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {dateFmt.format(new Date(t.transaction_date))}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.description}</span>
                      {t.tax_relevant && <Badge variant="default" className="h-5">Tax</Badge>}
                      {t.linked_document_id && (
                        <Badge variant="muted" className="h-5">Doc</Badge>
                      )}
                    </div>
                    {t.counterparty && (
                      <p className="text-xs text-muted-foreground">{t.counterparty}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {categoryById(t.category_id)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {workStreamById(t.work_stream_id)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {accountById(t.account_id)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <OwnershipBadge value={t.ownership_type} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={t.direction === "inflow" ? t.amount : -t.amount} colored signed />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(t);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => void remove("transactions", t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    No transactions match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editing}
      />
    </div>
  );
}
