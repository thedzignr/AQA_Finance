import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Money } from "@/components/shared/Money";
import { useData } from "@/data/DataProvider";
import type { OwnershipType, Transaction, TransactionSplit } from "@/types/domain";
import { cn, formatGBP, genId } from "@/lib/utils";

interface DraftSplit {
  id: string;
  category_id: string | null;
  work_stream_id: string | null;
  ownership_type: OwnershipType;
  business_use_pct: number;
  amount: number;
}

const OWNERSHIPS: OwnershipType[] = ["personal", "business", "mixed"];

export function SplitDialog({
  open,
  onOpenChange,
  transaction,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transaction: Transaction | null;
}) {
  const { data, insert, remove } = useData();
  const [rows, setRows] = useState<DraftSplit[]>([]);

  const expenseCats = useMemo(
    () =>
      [...data.categories]
        .filter((c) => ["income", "expense", "savings", "debt"].includes(c.kind))
        .sort((a, b) => a.sort_order - b.sort_order),
    [data.categories],
  );

  useEffect(() => {
    if (!open || !transaction) return;
    const existing = data.transactionSplits.filter(
      (s) => s.transaction_id === transaction.id,
    );
    if (existing.length > 0) {
      setRows(
        existing.map((s) => ({
          id: s.id,
          category_id: s.category_id,
          work_stream_id: s.work_stream_id,
          ownership_type: s.ownership_type,
          business_use_pct: s.business_use_pct,
          amount: s.amount,
        })),
      );
    } else {
      // Seed two rows from the parent transaction for convenience.
      setRows([
        {
          id: genId("sp"),
          category_id: transaction.category_id,
          work_stream_id: transaction.work_stream_id,
          ownership_type: transaction.ownership_type,
          business_use_pct: transaction.business_use_pct,
          amount: Math.round(transaction.amount * 0.5 * 100) / 100,
        },
        {
          id: genId("sp"),
          category_id: null,
          work_stream_id: transaction.work_stream_id,
          ownership_type: transaction.ownership_type,
          business_use_pct: 100,
          amount: Math.round(transaction.amount * 0.5 * 100) / 100,
        },
      ]);
    }
  }, [open, transaction, data.transactionSplits]);

  if (!transaction) return null;

  const allocated = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const remaining = Math.round((transaction.amount - allocated) * 100) / 100;
  const balanced = Math.abs(remaining) < 0.005;
  const existingSplitCount = data.transactionSplits.filter(
    (s) => s.transaction_id === transaction.id,
  ).length;

  function update(id: string, patch: Partial<DraftSplit>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [
      ...rs,
      {
        id: genId("sp"),
        category_id: null,
        work_stream_id: transaction!.work_stream_id,
        ownership_type: transaction!.ownership_type,
        business_use_pct: 100,
        amount: remaining > 0 ? remaining : 0,
      },
    ]);
  }
  function distributeRemainder() {
    if (rows.length === 0) return;
    const last = rows[rows.length - 1];
    update(last.id, {
      amount: Math.round((last.amount + remaining) * 100) / 100,
    });
  }

  async function save() {
    if (!balanced) return;
    // Replace strategy: clear existing splits, then insert the current rows.
    const existing = data.transactionSplits.filter(
      (s) => s.transaction_id === transaction!.id,
    );
    for (const s of existing) {
      await remove("transactionSplits", s.id);
    }
    for (const r of rows) {
      const split: TransactionSplit = {
        id: r.id,
        transaction_id: transaction!.id,
        category_id: r.category_id,
        work_stream_id: r.work_stream_id,
        ownership_type: r.ownership_type,
        amount: Number(r.amount) || 0,
        business_use_pct: r.ownership_type === "mixed" ? r.business_use_pct : 100,
        notes: null,
      };
      await insert("transactionSplits", split);
    }
    onOpenChange(false);
  }

  async function clearSplits() {
    const existing = data.transactionSplits.filter(
      (s) => s.transaction_id === transaction!.id,
    );
    for (const s of existing) {
      await remove("transactionSplits", s.id);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Split transaction</DialogTitle>
          <DialogDescription>
            Allocate “{transaction.description}” ({formatGBP(transaction.amount)})
            across multiple categories, work streams or business-use percentages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {/* Header row */}
          <div className="hidden grid-cols-[1fr_1fr_120px_90px_110px_36px] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Category</span>
            <span>Work stream</span>
            <span>Ownership</span>
            <span>Biz %</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-2 gap-2 rounded-md border p-2 md:grid-cols-[1fr_1fr_120px_90px_110px_36px] md:border-0 md:p-0"
              >
                <Select
                  value={r.category_id ?? "none"}
                  onValueChange={(v) => update(r.id, { category_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="none">Uncategorised</SelectItem>
                    {expenseCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={r.work_stream_id ?? "none"}
                  onValueChange={(v) => update(r.id, { work_stream_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Work stream" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {data.workStreams.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={r.ownership_type}
                  onValueChange={(v) => update(r.id, { ownership_type: v as OwnershipType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OWNERSHIPS.map((o) => (
                      <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  min={0}
                  max={100}
                  disabled={r.ownership_type !== "mixed"}
                  value={r.business_use_pct}
                  onChange={(e) => update(r.id, { business_use_pct: parseFloat(e.target.value) || 0 })}
                />

                <Input
                  type="number"
                  step="0.01"
                  className="text-right"
                  value={r.amount}
                  onChange={(e) => update(r.id, { amount: parseFloat(e.target.value) || 0 })}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive"
                  onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4" /> Add split
            </Button>
            {!balanced && (
              <Button variant="ghost" size="sm" onClick={distributeRemainder}>
                <Wand2 className="h-4 w-4" /> Add remainder to last
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Allocated</span>
              <Money value={allocated} className="font-medium" />
              <Badge variant={balanced ? "success" : "warning"}>
                {balanced ? "Balanced" : `${remaining > 0 ? "Under" : "Over"} ${formatGBP(Math.abs(remaining))}`}
              </Badge>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <div>
            {existingSplitCount > 0 && (
              <Button variant="ghost" className="text-destructive" onClick={() => void clearSplits()}>
                Remove all splits
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => void save()}
              disabled={!balanced || rows.length === 0}
              className={cn(!balanced && "opacity-60")}
            >
              Save split ({rows.length})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
