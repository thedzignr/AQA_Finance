import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { useData } from "@/data/DataProvider";
import { accountBalance } from "@/lib/selectors";
import { formatGBP, genId, titleCase } from "@/lib/utils";
import { DEMO_USER_ID } from "@/data/seed";
import type { Account, AccountType } from "@/types/domain";

const TYPE_LABELS: Record<AccountType, string> = {
  current: "Current",
  savings: "Savings",
  credit_card: "Credit card",
  cash: "Cash",
  loan: "Loan",
  tax_pot: "Tax pot",
  other: "Other",
};

const LIABILITY_TYPES: AccountType[] = ["credit_card", "loan"];

export function AccountsPage() {
  const { data } = useData();
  const [filter, setFilter] = useState<AccountType | "all">("all");
  const [addOpen, setAddOpen] = useState(false);

  const accounts = useMemo(
    () =>
      data.accounts
        .filter((a) => filter === "all" || a.account_type === filter)
        .sort((a, b) => a.account_type.localeCompare(b.account_type)),
    [data.accounts, filter],
  );

  const assets = data.accounts
    .filter((a) => !LIABILITY_TYPES.includes(a.account_type))
    .reduce((s, a) => s + accountBalance(a), 0);
  const liabilities = data.accounts
    .filter((a) => LIABILITY_TYPES.includes(a.account_type))
    .reduce((s, a) => s + Math.abs(accountBalance(a)), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="All your bank accounts, savings, cards and pots in one place."
        actions={
          <>
            <Select value={filter} onValueChange={(v) => setFilter(v as AccountType | "all")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add account
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Assets" value={formatGBP(assets)} accent="success" />
        <StatCard label="Liabilities" value={formatGBP(liabilities)} accent="destructive" />
        <StatCard label="Net" value={formatGBP(assets - liabilities)} accent="primary" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => {
          const balance = accountBalance(a);
          const isLiability = LIABILITY_TYPES.includes(a.account_type);
          return (
            <Link key={a.id} to={`/accounts/${a.id}`}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.provider ?? "—"} {a.last4 ? `•••• ${a.last4}` : ""}
                      </p>
                    </div>
                    <Badge variant="muted">{TYPE_LABELS[a.account_type]}</Badge>
                  </div>
                  <p
                    className={`mt-4 text-2xl font-semibold tnum ${
                      isLiability || balance < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatGBP(balance)}
                  </p>
                  {!a.active && (
                    <Badge variant="secondary" className="mt-2">
                      Inactive
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {accounts.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Wallet className="h-6 w-6" />
              <p>No accounts for this filter.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <AccountDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { insert } = useData();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("current");
  const [provider, setProvider] = useState("");
  const [balance, setBalance] = useState("0");

  async function save() {
    if (!name) return;
    const row: Account = {
      id: genId("acc"),
      user_id: DEMO_USER_ID,
      name,
      account_type: type,
      provider: provider || null,
      currency: "GBP",
      opening_balance: parseFloat(balance) || 0,
      current_balance: parseFloat(balance) || 0,
      last4: null,
      active: true,
      created_at: new Date().toISOString(),
    };
    await insert("accounts", row);
    setName("");
    setProvider("");
    setBalance("0");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Business Current" />
          </div>
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Tide" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(TYPE_LABELS).map((k) => (
                    <SelectItem key={k} value={k}>
                      {titleCase(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Balance (£)</Label>
              <Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name}>
            Add account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
