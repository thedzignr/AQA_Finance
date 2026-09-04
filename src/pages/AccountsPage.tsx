import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Landmark, PiggyBank, Plus, Receipt, Wallet } from "lucide-react";
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
import { IconWell } from "@/components/shared/IconWell";
import { StatCard } from "@/components/shared/StatCard";
import { useData } from "@/data/DataProvider";
import { accountBalance } from "@/lib/selectors";
import { daysUntil, formatGBP, genId } from "@/lib/utils";
import { useAuth } from "@/data/auth";
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

const TYPE_ICONS: Record<AccountType, typeof Wallet> = {
  current: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  cash: Wallet,
  loan: Landmark,
  tax_pot: Receipt,
  other: Wallet,
};

const LIABILITY_TYPES: AccountType[] = ["credit_card", "loan"];

const offerDateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Active 0% offer info for a credit-card account, or null. */
function cardOffer(a: Account): { until: string; daysLeft: number } | null {
  if (a.account_type !== "credit_card" || !a.interest_free_until) return null;
  const daysLeft = daysUntil(a.interest_free_until);
  return daysLeft > 0 ? { until: a.interest_free_until, daysLeft } : null;
}

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
        icon={Wallet}
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
        <StatCard label="Assets" value={formatGBP(assets)} icon={Wallet} accent="success" />
        <StatCard label="Liabilities" value={formatGBP(liabilities)} icon={CreditCard} accent="destructive" />
        <StatCard label="Net" value={formatGBP(assets - liabilities)} icon={Landmark} accent="primary" />
      </div>

      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((a) => {
          const balance = accountBalance(a);
          const isLiability = LIABILITY_TYPES.includes(a.account_type);
          return (
            <Link key={a.id} to={`/accounts/${a.id}`} className="block h-full">
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <IconWell
                        icon={TYPE_ICONS[a.account_type]}
                        size="sm"
                        variant={isLiability ? "destructive" : "accent"}
                      />
                      <div className="min-w-0">
                        <p className="font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.provider ?? "—"} {a.last4 ? `•••• ${a.last4}` : ""}
                        </p>
                      </div>
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
                  {(() => {
                    const offer = cardOffer(a);
                    if (!offer) return null;
                    return (
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge variant="success">0% until {offerDateFmt.format(new Date(offer.until))}</Badge>
                        <span className="text-muted-foreground">{offer.daysLeft}d left</span>
                      </p>
                    );
                  })()}
                  {a.account_type === "credit_card" && a.credit_limit != null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatGBP(a.credit_limit - Math.abs(balance))} of {formatGBP(a.credit_limit)} available
                    </p>
                  )}
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
  const { userId } = useAuth();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("current");
  const [provider, setProvider] = useState("");
  const [balance, setBalance] = useState("0");
  // Credit-card terms (only used when type === "credit_card")
  const [creditLimit, setCreditLimit] = useState("");
  const [apr, setApr] = useState("");
  const [offerExpiry, setOfferExpiry] = useState("");
  const [promoApr, setPromoApr] = useState("0");

  const isCard = type === "credit_card";

  function reset() {
    setName("");
    setProvider("");
    setBalance("0");
    setCreditLimit("");
    setApr("");
    setOfferExpiry("");
    setPromoApr("0");
  }

  async function save() {
    if (!name || !userId) return;
    const row: Account = {
      id: genId("acc"),
      user_id: userId,
      name,
      account_type: type,
      provider: provider || null,
      currency: "GBP",
      opening_balance: parseFloat(balance) || 0,
      current_balance: parseFloat(balance) || 0,
      last4: null,
      active: true,
      credit_limit: isCard && creditLimit ? parseFloat(creditLimit) : null,
      apr: isCard && apr ? parseFloat(apr) : null,
      interest_free_until: isCard && offerExpiry ? offerExpiry : null,
      promo_apr: isCard && offerExpiry ? parseFloat(promoApr) || 0 : null,
      created_at: new Date().toISOString(),
    };
    await insert("accounts", row);
    reset();
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
                  {(Object.keys(TYPE_LABELS) as AccountType[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {TYPE_LABELS[k]}
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

          {isCard && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Credit-card terms
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Credit limit (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="e.g. 5000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Standard APR (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={apr}
                    onChange={(e) => setApr(e.target.value)}
                    placeholder="e.g. 24.9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Interest-free offer expiry</Label>
                  <Input
                    type="date"
                    value={offerExpiry}
                    onChange={(e) => setOfferExpiry(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Offer APR (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={promoApr}
                    onChange={(e) => setPromoApr(e.target.value)}
                    disabled={!offerExpiry}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave the expiry blank if there’s no 0% deal. After it passes, the standard APR applies.
              </p>
            </div>
          )}
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
