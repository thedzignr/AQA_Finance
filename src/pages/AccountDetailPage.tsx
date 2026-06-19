import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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
import { Money } from "@/components/shared/Money";
import { StatCard } from "@/components/shared/StatCard";
import {
  ReconciliationBadge,
} from "@/components/shared/StatusBadges";
import { useData } from "@/data/DataProvider";
import { accountBalance } from "@/lib/selectors";
import { formatGBP, titleCase } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

export function AccountDetailPage() {
  const { accountId } = useParams();
  const { data, categoryById, workStreamById } = useData();
  const account = data.accounts.find((a) => a.id === accountId);

  const transactions = useMemo(
    () =>
      data.transactions
        .filter((t) => t.account_id === accountId)
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    [data.transactions, accountId],
  );

  const bankRows = useMemo(
    () =>
      data.bankTransactions
        .filter((b) => b.account_id === accountId)
        .sort((a, b) => b.txn_date.localeCompare(a.txn_date)),
    [data.bankTransactions, accountId],
  );

  if (!account) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/accounts">
            <ArrowLeft className="h-4 w-4" /> Back to accounts
          </Link>
        </Button>
        <p className="text-muted-foreground">Account not found.</p>
      </div>
    );
  }

  const inflow = transactions.filter((t) => t.direction === "inflow").reduce((s, t) => s + t.amount, 0);
  const outflow = transactions.filter((t) => t.direction === "outflow").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/accounts">
          <ArrowLeft className="h-4 w-4" /> Accounts
        </Link>
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{account.name}</h2>
          <p className="text-sm text-muted-foreground">
            {account.provider ?? "—"} · {titleCase(account.account_type)}{" "}
            {account.last4 ? `· •••• ${account.last4}` : ""}
          </p>
        </div>
        <Badge variant={account.active ? "success" : "secondary"}>
          {account.active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Balance" value={formatGBP(accountBalance(account))} accent="primary" />
        <StatCard label="Money in" value={formatGBP(inflow)} accent="success" />
        <StatCard label="Money out" value={formatGBP(outflow)} accent="destructive" />
        <StatCard label="Transactions" value={String(transactions.length)} />
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Ledger ({transactions.length})</TabsTrigger>
          <TabsTrigger value="reconcile">Bank rows ({bankRows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Work stream</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {dateFmt.format(new Date(t.transaction_date))}
                      </TableCell>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {categoryById(t.category_id)?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {workStreamById(t.work_stream_id)?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={t.direction === "inflow" ? t.amount : -t.amount} colored signed />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconcile">
          <Card>
            <CardHeader>
              <CardTitle>Imported bank rows</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankRows.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {dateFmt.format(new Date(b.txn_date))}
                      </TableCell>
                      <TableCell className="font-medium">{b.description}</TableCell>
                      <TableCell className="text-right">
                        <Money value={b.direction === "inflow" ? b.amount : -b.amount} colored signed />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {b.balance != null ? formatGBP(b.balance) : "—"}
                      </TableCell>
                      <TableCell>
                        <ReconciliationBadge value={b.reconciliation_status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {bankRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No imported bank rows for this account.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
