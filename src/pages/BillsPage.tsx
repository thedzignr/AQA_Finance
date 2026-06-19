import { useMemo, useState } from "react";
import { CalendarClock, Plus, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Money } from "@/components/shared/Money";
import { useData } from "@/data/DataProvider";
import {
  estimatedMonthlyFixedCosts,
  nextDueDateForBill,
  upcomingBills,
} from "@/lib/selectors";
import { detectRecurringBills } from "@/lib/insights";
import { formatGBP, genId, titleCase } from "@/lib/utils";
import { DEMO_USER_ID } from "@/data/seed";
import type { Bill } from "@/types/domain";

const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

export function BillsPage() {
  const { data, accountById, categoryById, insert } = useData();
  const [detected, setDetected] = useState(false);

  const upcoming = useMemo(() => upcomingBills(data, 45), [data]);
  const monthlyFixed = useMemo(() => estimatedMonthlyFixedCosts(data), [data]);
  const recurringSuggestions = useMemo(() => detectRecurringBills(data), [data]);

  const upcomingSubs = useMemo(
    () =>
      data.subscriptions
        .filter((s) => s.active && s.next_due_date)
        .sort((a, b) => (a.next_due_date ?? "").localeCompare(b.next_due_date ?? "")),
    [data.subscriptions],
  );

  const totalUpcoming = upcoming.reduce((s, b) => s + b.amount, 0);
  const subMonthly = data.subscriptions
    .filter((s) => s.active)
    .reduce((s, x) => s + x.amount_estimate, 0);

  async function addDetectedBill(name: string, amount: number) {
    const bill: Bill = {
      id: genId("bill"),
      user_id: DEMO_USER_ID,
      name,
      category_id: null,
      amount_estimate: Math.round(amount * 100) / 100,
      due_day: new Date().getDate(),
      frequency: "monthly",
      account_id: data.accounts[0]?.id ?? null,
      autopay: false,
      active: true,
      notes: "Auto-detected from recurring spending",
      created_at: new Date().toISOString(),
    };
    await insert("bills", bill);
    setDetected(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills & Subscriptions"
        description="Track recurring bills and subscriptions, see what’s due, and estimate your fixed monthly costs."
        actions={
          <Button variant="outline" size="sm" disabled>
            <Plus className="h-4 w-4" /> Add bill
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Due (45 days)" value={formatGBP(totalUpcoming)} icon={CalendarClock} accent="warning" />
        <StatCard label="Est. monthly fixed" value={formatGBP(monthlyFixed)} accent="primary" />
        <StatCard label="Subscriptions/mo" value={formatGBP(subMonthly)} />
        <StatCard label="Active bills" value={String(data.bills.filter((b) => b.active).length)} />
      </div>

      {/* Recurring detection */}
      {recurringSuggestions.length > 0 && !detected && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Detected recurring spending
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recurringSuggestions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void addDetectedBill(s.title.replace("Possible recurring bill: ", ""), s.amount ?? 0)}>
                  Add as bill
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming calendar */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...upcoming.map((u) => ({
            id: u.bill.id,
            name: u.bill.name,
            date: u.dueDate,
            amount: u.amount,
            account: accountById(u.bill.account_id)?.name,
            autopay: u.bill.autopay,
            kind: "Bill",
          })),
          ...upcomingSubs.map((s) => ({
            id: s.id,
            name: s.name,
            date: s.next_due_date!,
            amount: s.amount_estimate,
            account: accountById(s.account_id)?.name,
            autopay: true,
            kind: "Subscription",
          }))]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((item) => {
              const overdue = new Date(item.date) < new Date(new Date().toDateString());
              return (
                <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dateFmt.format(new Date(item.date))} · {item.account ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {overdue && <Badge variant="destructive">Overdue</Badge>}
                    {item.autopay && <Badge variant="muted">Autopay</Badge>}
                    <Badge variant="secondary">{item.kind}</Badge>
                    <Money value={item.amount} className="w-20 text-right" />
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Tabs defaultValue="bills">
        <TabsList>
          <TabsTrigger value="bills">Bills ({data.bills.length})</TabsTrigger>
          <TabsTrigger value="subs">Subscriptions ({data.subscriptions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="bills">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Next due</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bills.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        {b.name} {b.autopay && <Badge variant="muted" className="ml-1">Auto</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{categoryById(b.category_id)?.name ?? "—"}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{b.frequency}</TableCell>
                      <TableCell className="text-muted-foreground">{accountById(b.account_id)?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{dateFmt.format(new Date(nextDueDateForBill(b)))}</TableCell>
                      <TableCell className="text-right"><Money value={b.amount_estimate} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subs">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Next due</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.subscriptions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{titleCase(s.billing_cycle)}</TableCell>
                      <TableCell className="text-muted-foreground">{accountById(s.account_id)?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.next_due_date ? dateFmt.format(new Date(s.next_due_date)) : "—"}</TableCell>
                      <TableCell className="text-right"><Money value={s.amount_estimate} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
