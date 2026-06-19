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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useData } from "@/data/DataProvider";
import type {
  Direction,
  OwnershipType,
  Transaction,
  TransactionKind,
} from "@/types/domain";
import { genId, todayISO } from "@/lib/utils";
import { DEMO_USER_ID } from "@/data/seed";

const KINDS: TransactionKind[] = [
  "income",
  "expense",
  "transfer",
  "debt_payment",
  "savings",
  "adjustment",
];
const OWNERSHIPS: OwnershipType[] = ["personal", "business", "mixed"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing transaction to edit, or null to create. */
  transaction?: Transaction | null;
  defaults?: Partial<Transaction>;
}

export function TransactionDialog({ open, onOpenChange, transaction, defaults }: Props) {
  const { data, insert, update } = useData();
  const isEdit = Boolean(transaction);

  const [form, setForm] = useState<Partial<Transaction>>({});

  useEffect(() => {
    if (open) {
      setForm(
        transaction ?? {
          transaction_date: todayISO(),
          kind: "expense",
          direction: "outflow",
          ownership_type: "personal",
          amount: 0,
          business_use_pct: 100,
          tax_relevant: false,
          account_id: data.accounts[0]?.id ?? null,
          currency: "GBP",
          description: "",
          ...defaults,
        },
      );
    }
  }, [open, transaction, defaults, data.accounts]);

  const categoriesForKind = useMemo(() => {
    const kind = form.kind;
    const mapping: Record<string, string[]> = {
      income: ["income"],
      expense: ["expense"],
      transfer: ["transfer"],
      debt_payment: ["debt"],
      savings: ["savings"],
      adjustment: ["income", "expense"],
    };
    const kinds = mapping[kind ?? "expense"] ?? ["expense"];
    return data.categories
      .filter((c) => kinds.includes(c.kind))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [data.categories, form.kind]);

  function set<K extends keyof Transaction>(key: K, value: Transaction[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.description || !form.amount) return;
    if (isEdit && transaction) {
      await update("transactions", transaction.id, {
        ...form,
        updated_at: new Date().toISOString(),
      });
    } else {
      const now = new Date().toISOString();
      const row: Transaction = {
        id: genId("t"),
        user_id: DEMO_USER_ID,
        account_id: form.account_id ?? null,
        work_stream_id: form.work_stream_id ?? null,
        category_id: form.category_id ?? null,
        transaction_date: form.transaction_date ?? todayISO(),
        posted_date: form.posted_date ?? form.transaction_date ?? todayISO(),
        kind: form.kind ?? "expense",
        ownership_type: form.ownership_type ?? "personal",
        counterparty: form.counterparty ?? null,
        description: form.description ?? "",
        amount: Number(form.amount) || 0,
        direction: form.direction ?? "outflow",
        currency: "GBP",
        business_use_pct: form.business_use_pct ?? 100,
        tax_relevant: form.tax_relevant ?? false,
        recurring_rule_id: null,
        linked_document_id: form.linked_document_id ?? null,
        linked_bill_id: form.linked_bill_id ?? null,
        linked_debt_id: form.linked_debt_id ?? null,
        transfer_group_id: form.transfer_group_id ?? null,
        reconciliation_status: form.reconciliation_status ?? "unreconciled",
        review_status: form.review_status ?? "none",
        notes: form.notes ?? null,
        created_at: now,
        updated_at: now,
      };
      await insert("transactions", row);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription>
            Record income, spending, transfers, debt payments or savings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-1 py-1 sm:grid-cols-2">
          <Field label="Description" full>
            <Input
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Shell fuel"
            />
          </Field>

          <Field label="Counterparty">
            <Input
              value={form.counterparty ?? ""}
              onChange={(e) => set("counterparty", e.target.value)}
              placeholder="e.g. Shell"
            />
          </Field>

          <Field label="Amount (£)">
            <Input
              type="number"
              step="0.01"
              value={form.amount ?? 0}
              onChange={(e) => set("amount", parseFloat(e.target.value))}
            />
          </Field>

          <Field label="Date">
            <Input
              type="date"
              value={form.transaction_date ?? todayISO()}
              onChange={(e) => set("transaction_date", e.target.value)}
            />
          </Field>

          <Field label="Direction">
            <Select
              value={form.direction}
              onValueChange={(v) => set("direction", v as Direction)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inflow">Money in (inflow)</SelectItem>
                <SelectItem value="outflow">Money out (outflow)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Kind">
            <Select value={form.kind} onValueChange={(v) => set("kind", v as TransactionKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k} className="capitalize">
                    {k.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Account">
            <Select
              value={form.account_id ?? "none"}
              onValueChange={(v) => set("account_id", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Account" />
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
          </Field>

          <Field label="Category">
            <Select
              value={form.category_id ?? "none"}
              onValueChange={(v) => set("category_id", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorised</SelectItem>
                {categoriesForKind.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Work stream">
            <Select
              value={form.work_stream_id ?? "none"}
              onValueChange={(v) => set("work_stream_id", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Work stream" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {data.workStreams.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Ownership">
            <Select
              value={form.ownership_type}
              onValueChange={(v) => set("ownership_type", v as OwnershipType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OWNERSHIPS.map((o) => (
                  <SelectItem key={o} value={o} className="capitalize">
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {form.ownership_type === "mixed" && (
            <Field label="Business use %">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.business_use_pct ?? 100}
                onChange={(e) => set("business_use_pct", parseFloat(e.target.value))}
              />
            </Field>
          )}

          <Field label="Notes" full>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes"
            />
          </Field>

          <div className="col-span-full flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Tax relevant</p>
              <p className="text-xs text-muted-foreground">
                Include in sole-trader tax records & evidence tracking.
              </p>
            </div>
            <Switch
              checked={form.tax_relevant ?? false}
              onCheckedChange={(v) => set("tax_relevant", v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!form.description || !form.amount}>
            {isEdit ? "Save changes" : "Add transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-full space-y-1.5" : "space-y-1.5"}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
