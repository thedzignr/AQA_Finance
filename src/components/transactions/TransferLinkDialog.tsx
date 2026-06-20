import { useMemo, useState } from "react";
import { ArrowLeftRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/shared/Money";
import { useData } from "@/data/DataProvider";
import type { Transaction } from "@/types/domain";
import { cn, genId } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

export function TransferLinkDialog({
  open,
  onOpenChange,
  transaction,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transaction: Transaction | null;
}) {
  const { data, update, accountById } = useData();
  const [pick, setPick] = useState<string | null>(null);

  // Candidates: opposite direction, different account, similar amount & date.
  const candidates = useMemo(() => {
    if (!transaction) return [];
    const oppDir = transaction.direction === "inflow" ? "outflow" : "inflow";
    return data.transactions
      .filter(
        (t) =>
          t.id !== transaction.id &&
          t.direction === oppDir &&
          t.account_id !== transaction.account_id &&
          !t.transfer_group_id,
      )
      .map((t) => ({
        t,
        amountClose: Math.abs(t.amount - transaction.amount) < 0.01,
        dayClose:
          Math.abs(
            new Date(t.transaction_date).getTime() -
              new Date(transaction.transaction_date).getTime(),
          ) /
            86400000 <=
          5,
      }))
      .sort((a, b) => {
        const score = (x: typeof a) => (x.amountClose ? 2 : 0) + (x.dayClose ? 1 : 0);
        return score(b) - score(a);
      })
      .slice(0, 30);
  }, [data.transactions, transaction]);

  if (!transaction) return null;

  async function link() {
    if (!pick || !transaction) return;
    const groupId = transaction.transfer_group_id ?? genId("grp");
    await update("transactions", transaction.id, {
      transfer_group_id: groupId,
      kind: "transfer",
      reconciliation_status: "matched",
    });
    await update("transactions", pick, {
      transfer_group_id: groupId,
      kind: "transfer",
      reconciliation_status: "matched",
    });
    onOpenChange(false);
    setPick(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" /> Link as transfer
          </DialogTitle>
          <DialogDescription>
            Pair “{transaction.description}” ({accountById(transaction.account_id)?.name ?? "—"})
            with its matching entry on another account so it isn’t double-counted in cashflow.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
          {candidates.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No matching counter-transactions found.
            </p>
          )}
          {candidates.map(({ t, amountClose, dayClose }) => (
            <button
              key={t.id}
              onClick={() => setPick(t.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md border p-2.5 text-left text-sm transition-colors",
                pick === t.id ? "border-primary bg-primary/5" : "hover:bg-accent/40",
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground">
                  {dateFmt.format(new Date(t.transaction_date))} · {accountById(t.account_id)?.name ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {amountClose && <Badge variant="success">Amount</Badge>}
                {dayClose && <Badge variant="muted">Date</Badge>}
                <Money value={t.direction === "inflow" ? t.amount : -t.amount} colored signed />
                {pick === t.id && <Check className="h-4 w-4 text-primary" />}
              </div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void link()} disabled={!pick}>
            Link transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
