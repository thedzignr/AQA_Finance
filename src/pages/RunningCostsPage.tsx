import { useMemo, useState } from "react";
import { Layers, Plus, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { SectionTitle } from "@/components/shared/IconWell";
import { StatCard } from "@/components/shared/StatCard";
import { useData } from "@/data/DataProvider";
import { appRunningCosts } from "@/lib/selectors";
import { formatGBP, genId } from "@/lib/utils";
import { useAuth } from "@/data/auth";
import type { BillingCycle, OperatingCost, OperatingCostCategory } from "@/types/domain";

const CATEGORY_LABELS: Record<OperatingCostCategory, string> = {
  ai: "AI / LLM",
  hosting: "Hosting",
  database: "Database",
  domain: "Domain",
  email: "Email",
  tooling: "Tooling",
  other: "Other",
};

const CATEGORY_BAR: Record<OperatingCostCategory, string> = {
  ai: "bg-chart-5",
  hosting: "bg-chart-1",
  database: "bg-chart-2",
  domain: "bg-chart-3",
  email: "bg-chart-4",
  tooling: "bg-success",
  other: "bg-muted-foreground",
};

const CYCLE_LABEL: Record<BillingCycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function RunningCostsPage() {
  const { data } = useData();
  const [addOpen, setAddOpen] = useState(false);
  const costs = useMemo(() => appRunningCosts(data), [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="App running costs"
        icon={Server}
        description="What it costs to run this product itself — infrastructure and SaaS like Claude, Vercel and Supabase, normalised to a monthly figure."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add cost
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Per month" value={formatGBP(costs.monthlyTotal)} accent="destructive" />
        <StatCard label="Per year" value={formatGBP(costs.yearlyTotal)} accent="warning" />
        <StatCard label="Usage-based/mo" value={formatGBP(costs.usageBasedMonthly)} hint="Metered / variable" />
        <StatCard label="Active services" value={String(costs.items.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Breakdown by category */}
        <Card>
          <CardHeader>
            <SectionTitle icon={Layers}>By category</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {costs.byCategory.length === 0 && (
              <p className="text-sm text-muted-foreground">No costs tracked yet.</p>
            )}
            {costs.byCategory.map(({ category, monthly }) => {
              const pct = costs.monthlyTotal > 0 ? (monthly / costs.monthlyTotal) * 100 : 0;
              return (
                <div key={category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{CATEGORY_LABELS[category]}</span>
                    <span className="text-muted-foreground">
                      {formatGBP(monthly)}/mo · {Math.round(pct)}%
                    </span>
                  </div>
                  <Progress value={pct} indicatorClassName={CATEGORY_BAR[category]} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Line items */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionTitle icon={Server}>Services</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {costs.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between border-b py-2 last:border-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{item.name}</p>
                    <Badge variant="muted">{CATEGORY_LABELS[item.category]}</Badge>
                    {item.usage_based && <Badge variant="warning">Usage-based</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.vendor ?? "—"} · {formatGBP(item.amount_estimate)} {CYCLE_LABEL[item.billing_cycle].toLowerCase()}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </p>
                </div>
                <div className="whitespace-nowrap text-right">
                  <p className="font-semibold tnum text-destructive">{formatGBP(item.monthly)}</p>
                  <p className="text-xs text-muted-foreground">/mo</p>
                </div>
              </div>
            ))}
            {costs.items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Server className="h-6 w-6" />
                <p>No running costs yet. Add Claude, Vercel, Supabase…</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CostDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}


function CostDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { insert } = useData();
  const { userId } = useAuth();
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState<OperatingCostCategory>("hosting");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [usageBased, setUsageBased] = useState(false);

  function reset() {
    setName("");
    setVendor("");
    setCategory("hosting");
    setAmount("");
    setCycle("monthly");
    setUsageBased(false);
  }

  async function save() {
    if (!name || !userId) return;
    const row: OperatingCost = {
      id: genId("op"),
      user_id: userId,
      name,
      vendor: vendor || null,
      category,
      amount_estimate: parseFloat(amount) || 0,
      billing_cycle: cycle,
      usage_based: usageBased,
      active: true,
      notes: null,
      created_at: new Date().toISOString(),
    };
    await insert("operatingCosts", row);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add running cost</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude API" />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Anthropic" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as OperatingCostCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Billing</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CYCLE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (£)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={usageBased}
                onChange={(e) => setUsageBased(e.target.checked)}
                className="h-4 w-4"
              />
              Usage-based (estimate)
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name}>
            Add cost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
