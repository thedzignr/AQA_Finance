import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  FileSearch,
  Files,
  Filter,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  Scale,
  Search,
  ShieldCheck,
  UploadCloud,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Progress } from './components/ui/progress';
import { Table, TBody, Td, Th, THead } from './components/ui/table';
import {
  detectMonthlyBillsFromBankRows,
  documentAdapters,
  type ParsedDocument,
} from './lib/document-adapters';
import {
  getAccountName,
  getCategoryName,
  getDashboardMetrics,
  getWorkStreamName,
  getWorkStreamSummaries,
  loadFinanceData,
  type FinanceData,
} from './lib/finance-data';
import { cn, formatCompactCurrency, formatCurrency, formatDate, percentage } from './lib/utils';
import type { AccountType, OwnershipType, ReviewStatus } from './types/database';
import './index.css';

type RouteId =
  | 'dashboard'
  | 'accounts'
  | 'transactions'
  | 'work-streams'
  | 'documents'
  | 'review'
  | 'bills'
  | 'debts'
  | 'budget'
  | 'tax';

const routes: Array<{ id: RouteId; label: string; icon: ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={17} /> },
  { id: 'accounts', label: 'Accounts', icon: <Landmark size={17} /> },
  { id: 'transactions', label: 'Transactions', icon: <ReceiptText size={17} /> },
  { id: 'work-streams', label: 'Work Streams', icon: <BriefcaseBusiness size={17} /> },
  { id: 'documents', label: 'Documents', icon: <Files size={17} /> },
  { id: 'review', label: 'Review Queue', icon: <ClipboardCheck size={17} /> },
  { id: 'bills', label: 'Bills', icon: <CalendarClock size={17} /> },
  { id: 'debts', label: 'Debts', icon: <CreditCard size={17} /> },
  { id: 'budget', label: 'Budget', icon: <PiggyBank size={17} /> },
  { id: 'tax', label: 'Tax & Records', icon: <Scale size={17} /> },
];

const routeTitles: Record<RouteId, string> = {
  dashboard: 'Home Dashboard',
  accounts: 'Accounts',
  transactions: 'Unified Transactions',
  'work-streams': 'Work Streams',
  documents: 'Documents',
  review: 'Review Queue',
  bills: 'Bills & Subscriptions',
  debts: 'Debts',
  budget: 'Budget',
  tax: 'Tax & Records',
};

const routeDescriptions: Record<RouteId, string> = {
  dashboard: 'Day-to-day cash flow, debt position, tax pot and review priorities.',
  accounts: 'Multiple current, savings, credit card, cash, loan and tax pot accounts.',
  transactions: 'One searchable ledger for personal, business and mixed-use money movement.',
  'work-streams': 'Profitability across PHV, trade plate, design, freelance and other income.',
  documents: 'Upload and parse receipts, statements, invoices, screenshots, PDFs and CSVs.',
  review: 'Approve low-confidence OCR, evidence gaps, matches, splits and new transactions.',
  bills: 'Recurring fixed costs, subscriptions, warnings and estimated monthly commitments.',
  debts: 'Balances, APRs, minimum payments, due dates and payoff progress.',
  budget: 'Monthly planned versus actual spending by category, ownership and work stream.',
  tax: 'UK sole trader 2025/26 income, tax-relevant expenses and evidence coverage.',
};

function currentRouteFromHash(): RouteId {
  const hash = window.location.hash.replace('#/', '') as RouteId;
  return routes.some((route) => route.id === hash) ? hash : 'dashboard';
}

function Shell({
  route,
  setRoute,
  children,
}: {
  route: RouteId;
  setRoute: (route: RouteId) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_34rem),linear-gradient(135deg,#08111f_0%,#111827_52%,#0f172a_100%)] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-white/10 bg-slate-950/75 p-5 backdrop-blur-xl lg:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300 text-slate-950">
            <WalletCards size={23} />
          </div>
          <div>
            <p className="font-black tracking-tight">LedgerFlow</p>
            <p className="text-xs text-slate-400">UK sole trader finance</p>
          </div>
        </div>
        <nav className="space-y-1">
          {routes.map((item) => (
            <button
              key={item.id}
              className={cn(
                'focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white',
                route === item.id && 'bg-cyan-300/15 text-cyan-100 ring-1 ring-cyan-300/20',
              )}
              onClick={() => setRoute(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/70 px-4 py-4 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
                <ShieldCheck size={14} />
                Evidence-first ledger
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">{routeTitles[route]}</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">{routeDescriptions[route]}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm">
                <Search size={15} />
                Cmd K
              </Button>
              <Button size="sm">
                <UploadCloud size={15} />
                Upload evidence
              </Button>
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {routes.map((item) => (
              <button
                key={item.id}
                className={cn(
                  'focus-ring flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-slate-300',
                  route === item.id ? 'bg-cyan-300 text-slate-950' : 'bg-white/10',
                )}
                onClick={() => setRoute(item.id)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone = 'cyan',
  detail,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'cyan' | 'emerald' | 'amber' | 'rose';
  detail?: string;
}) {
  const toneClasses = {
    cyan: 'bg-cyan-300/15 text-cyan-100',
    emerald: 'bg-emerald-300/15 text-emerald-100',
    amber: 'bg-amber-300/15 text-amber-100',
    rose: 'bg-rose-300/15 text-rose-100',
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p>
          {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
        </div>
        <div className={cn('rounded-2xl p-3', toneClasses[tone])}>{icon}</div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: ReviewStatus | string }) {
  const variant =
    status === 'approved' || status === 'reconciled' || status === 'matched'
      ? 'success'
      : status === 'needs_review' || status === 'suggested_match' || status === 'processing'
        ? 'warning'
        : status === 'rejected' || status === 'failed'
          ? 'danger'
          : 'muted';

  return <Badge variant={variant}>{status.replaceAll('_', ' ')}</Badge>;
}

function Dashboard({ data }: { data: FinanceData }) {
  const metrics = getDashboardMetrics(data);
  const summaries = getWorkStreamSummaries(data);
  const upcomingBills = data.bills.filter((bill) => bill.active).slice(0, 4);
  const openTasks = data.reviewTasks.filter((task) => task.status === 'open');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total cash" value={formatCurrency(metrics.cash)} icon={<Banknote />} detail="Across active cash accounts" />
        <MetricCard label="Money in this month" value={formatCurrency(metrics.moneyIn)} icon={<ArrowUpRight />} tone="emerald" detail="Income receipts" />
        <MetricCard label="Money out this month" value={formatCurrency(metrics.moneyOut)} icon={<ArrowDownRight />} tone="amber" detail="Spend and debt payments" />
        <MetricCard label="Debt total" value={formatCurrency(metrics.debtTotal)} icon={<CreditCard />} tone="rose" detail="Active liabilities" />
        <MetricCard label="Tax pot balance" value={formatCurrency(metrics.taxPot)} icon={<PiggyBank />} tone="cyan" detail="Ring-fenced savings" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Work-stream income summary</CardTitle>
              <CardDescription>Income, allowable expense share and net position by stream.</CardDescription>
            </div>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {summaries.map((summary) => (
              <div key={summary.code} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-semibold text-white">{summary.name}</p>
                <p className="mt-3 text-2xl font-black">{formatCompactCurrency(summary.net)}</p>
                <div className="mt-3 flex justify-between text-xs text-slate-400">
                  <span>In {formatCompactCurrency(summary.income)}</span>
                  <span>Out {formatCompactCurrency(summary.expenses)}</span>
                </div>
                <div className="mt-3 flex h-12 items-end gap-1">
                  {summary.monthly.map((value, index) => (
                    <span
                      key={`${summary.code}-${index}`}
                      className="flex-1 rounded-t bg-cyan-300/70"
                      style={{ height: `${Math.max(10, Math.min(100, Math.abs(value) / 18))}%` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Needs review</CardTitle>
              <CardDescription>Prioritised OCR, matching and evidence tasks.</CardDescription>
            </div>
            <Badge variant="warning">{openTasks.length} open</Badge>
          </CardHeader>
          <div className="space-y-3">
            {openTasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-amber-50">{task.task_type.replaceAll('_', ' ')}</p>
                  <Badge variant={task.priority === 1 ? 'danger' : 'warning'}>P{task.priority}</Badge>
                </div>
                <p className="mt-1 text-xs text-amber-100/70">
                  {task.transaction_id ? getWorkStreamName(data, data.transactions.find((txn) => txn.id === task.transaction_id)?.work_stream_id ?? null) : 'Document inbox'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Upcoming bills</CardTitle>
              <CardDescription>Fixed costs and subscriptions due soon.</CardDescription>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {upcomingBills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] p-3">
                <div>
                  <p className="font-semibold">{bill.name}</p>
                  <p className="text-xs text-slate-400">Due day {bill.due_day ?? 'custom'} · {bill.frequency}</p>
                </div>
                <p className="font-bold">{formatCurrency(bill.amount_estimate)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Savings goal progress</CardTitle>
              <CardDescription>Emergency and tax reserve pots.</CardDescription>
            </div>
          </CardHeader>
          <div className="space-y-4">
            {data.savingsGoals.map((goal) => (
              <div key={goal.id}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-semibold">{goal.name}</span>
                  <span className="text-slate-400">{percentage(goal.current_amount, goal.target_amount ?? 0)}%</span>
                </div>
                <Progress value={percentage(goal.current_amount, goal.target_amount ?? 0)} />
                <p className="mt-1 text-xs text-slate-400">
                  {formatCurrency(goal.current_amount)} of {formatCurrency(goal.target_amount)}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest ledger entries and document matches.</CardDescription>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {data.transactions.slice(0, 5).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{transaction.description}</p>
                  <p className="text-xs text-slate-400">{formatDate(transaction.transaction_date)} · {getCategoryName(data, transaction.category_id)}</p>
                </div>
                <p className={cn('font-bold', transaction.direction === 'inflow' ? 'text-emerald-200' : 'text-rose-200')}>
                  {transaction.direction === 'inflow' ? '+' : '-'}{formatCurrency(transaction.amount)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Accounts({ data }: { data: FinanceData }) {
  const [filter, setFilter] = useState<AccountType | 'all'>('all');
  const accounts = filter === 'all' ? data.accounts : data.accounts.filter((account) => account.account_type === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['all', 'current', 'savings', 'credit_card', 'cash', 'loan', 'tax_pot', 'other'] as const).map((type) => (
          <Button key={type} variant={filter === type ? 'default' : 'secondary'} size="sm" onClick={() => setFilter(type)}>
            {type.replaceAll('_', ' ')}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => {
          const accountTransactions = data.transactions.filter((transaction) => transaction.account_id === account.id);

          return (
            <Card key={account.id}>
              <CardHeader>
                <div>
                  <CardTitle>{account.account_type.replaceAll('_', ' ')}</CardTitle>
                  <h3 className="mt-2 text-xl font-black">{account.name}</h3>
                  <CardDescription>{account.provider ?? 'Manual account'} {account.last4 ? `· ${account.last4}` : ''}</CardDescription>
                </div>
                <StatusBadge status={account.active ? 'active' : 'inactive'} />
              </CardHeader>
              <p className="text-3xl font-black">{formatCurrency(account.current_balance)}</p>
              <div className="mt-4 rounded-xl bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-400">Reconciled</span>
                  <span className="font-semibold">{accountTransactions.filter((txn) => txn.reconciliation_status === 'reconciled').length}/{accountTransactions.length}</span>
                </div>
                <Progress value={percentage(accountTransactions.filter((txn) => txn.reconciliation_status === 'reconciled').length, accountTransactions.length)} />
              </div>
              <div className="mt-4 space-y-2">
                {accountTransactions.slice(0, 3).map((transaction) => (
                  <div key={transaction.id} className="flex justify-between gap-3 text-sm">
                    <span className="truncate text-slate-300">{transaction.description}</span>
                    <span className="font-semibold">{formatCurrency(transaction.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Transactions({ data }: { data: FinanceData }) {
  const [query, setQuery] = useState('');
  const [ownership, setOwnership] = useState<OwnershipType | 'all'>('all');
  const [taxOnly, setTaxOnly] = useState(false);

  const filtered = data.transactions.filter((transaction) => {
    const text = `${transaction.description} ${transaction.counterparty ?? ''}`.toLowerCase();
    const matchesSearch = text.includes(query.toLowerCase());
    const matchesOwnership = ownership === 'all' || transaction.ownership_type === ownership;
    const matchesTax = !taxOnly || transaction.tax_relevant;
    return matchesSearch && matchesOwnership && matchesTax;
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Searchable unified ledger</CardTitle>
          <CardDescription>Filter by account, category, work stream, ownership, tax relevance and reconciliation.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Filter size={15} />Bulk edit</Button>
          <Button size="sm">Add transaction</Button>
        </div>
      </CardHeader>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={17} />
          <input
            className="focus-ring w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-10 pr-3 text-sm"
            placeholder="Search merchant, counterparty or notes..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          className="focus-ring rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm"
          value={ownership}
          onChange={(event) => setOwnership(event.target.value as OwnershipType | 'all')}
        >
          <option value="all">All ownership</option>
          <option value="personal">Personal</option>
          <option value="business">Business</option>
          <option value="mixed">Mixed</option>
        </select>
        <Button variant={taxOnly ? 'default' : 'secondary'} onClick={() => setTaxOnly((value) => !value)}>
          Tax relevant
        </Button>
      </div>
      <Table>
        <THead>
          <tr>
            <Th>Date</Th>
            <Th>Description</Th>
            <Th>Account</Th>
            <Th>Category</Th>
            <Th>Work stream</Th>
            <Th>Ownership</Th>
            <Th>Evidence</Th>
            <Th className="text-right">Amount</Th>
          </tr>
        </THead>
        <TBody>
          {filtered.map((transaction) => (
            <tr key={transaction.id}>
              <Td>{formatDate(transaction.transaction_date)}</Td>
              <Td>
                <p className="font-semibold">{transaction.description}</p>
                <p className="text-xs text-slate-500">{transaction.counterparty ?? 'Manual entry'} · {transaction.reconciliation_status.replaceAll('_', ' ')}</p>
              </Td>
              <Td>{getAccountName(data, transaction.account_id)}</Td>
              <Td>{getCategoryName(data, transaction.category_id)}</Td>
              <Td>{getWorkStreamName(data, transaction.work_stream_id)}</Td>
              <Td>
                <Badge variant={transaction.ownership_type === 'business' ? 'success' : transaction.ownership_type === 'mixed' ? 'warning' : 'muted'}>
                  {transaction.ownership_type}
                </Badge>
              </Td>
              <Td>
                {transaction.linked_document_id ? <Badge variant="success">linked</Badge> : transaction.tax_relevant ? <Badge variant="danger">missing</Badge> : <Badge variant="muted">not needed</Badge>}
              </Td>
              <Td className={cn('text-right font-bold', transaction.direction === 'inflow' ? 'text-emerald-200' : 'text-rose-200')}>
                {transaction.direction === 'inflow' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

function WorkStreams({ data }: { data: FinanceData }) {
  const summaries = getWorkStreamSummaries(data);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {summaries.map((summary) => (
        <Card key={summary.code}>
          <CardHeader>
            <div>
              <CardTitle>{summary.code}</CardTitle>
              <h3 className="mt-2 text-2xl font-black">{summary.name}</h3>
            </div>
            <Badge variant={summary.net >= 0 ? 'success' : 'danger'}>{summary.net >= 0 ? 'profitable' : 'loss'}</Badge>
          </CardHeader>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-300/10 p-3">
              <p className="text-xs text-emerald-100/70">Income</p>
              <p className="text-xl font-black">{formatCurrency(summary.income)}</p>
            </div>
            <div className="rounded-xl bg-rose-300/10 p-3">
              <p className="text-xs text-rose-100/70">Expenses</p>
              <p className="text-xl font-black">{formatCurrency(summary.expenses)}</p>
            </div>
            <div className="rounded-xl bg-cyan-300/10 p-3">
              <p className="text-xs text-cyan-100/70">Net</p>
              <p className="text-xl font-black">{formatCurrency(summary.net)}</p>
            </div>
          </div>
          <div className="mt-5">
            <p className="mb-3 text-sm font-semibold text-slate-300">Monthly trend</p>
            <div className="flex h-24 items-end gap-2 rounded-2xl bg-white/[0.03] p-4">
              {summary.monthly.map((amount, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <span className="w-full rounded-t bg-cyan-300" style={{ height: `${Math.max(8, Math.min(100, Math.abs(amount) / 14))}%` }} />
                  <span className="text-[10px] text-slate-500">{index + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Documents({ data }: { data: FinanceData }) {
  const [parsed, setParsed] = useState<ParsedDocument | null>(null);

  async function simulateParse(adapterId: string) {
    const adapter = documentAdapters.find((candidate) => candidate.id === adapterId);
    if (!adapter) {
      return;
    }

    const file = new File(['demo'], adapterId.includes('csv') ? 'monzo-june.csv' : adapterId.includes('phv') ? 'bolt-weekly.pdf' : 'shell-receipt.jpg', {
      type: adapter.accepts[0],
    });
    setParsed(await adapter.parse(file));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Upload inbox</CardTitle>
            <CardDescription>Accepts JPG, PNG, HEIC, PDF, CSV and screenshots.</CardDescription>
          </div>
        </CardHeader>
        <div className="rounded-3xl border border-dashed border-cyan-300/40 bg-cyan-300/10 p-8 text-center">
          <UploadCloud className="mx-auto text-cyan-100" size={44} />
          <p className="mt-4 text-lg font-black">Drop documents here</p>
          <p className="mt-2 text-sm text-slate-400">Original file remains unchanged; parsed output is stored separately.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {documentAdapters.map((adapter) => (
              <Button key={adapter.id} variant="secondary" size="sm" onClick={() => void simulateParse(adapter.id)}>
                {adapter.label}
              </Button>
            ))}
          </div>
        </div>
        {parsed && (
          <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold">{parsed.documentType.replaceAll('_', ' ')}</p>
              <StatusBadge status={parsed.reviewStatus} />
            </div>
            <p className="mt-2 text-sm text-slate-300">{parsed.normalized.supplier} · {formatCurrency(parsed.normalized.totalAmount)}</p>
            <p className="mt-1 text-xs text-slate-400">Confidence {Math.round(parsed.confidence * 100)}% · suggested {parsed.normalized.suggestedCategoryCode}</p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Document processing state</CardTitle>
            <CardDescription>Previews, extracted totals, parser confidence and suggested matches.</CardDescription>
          </div>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <Th>File</Th>
              <Th>Type</Th>
              <Th>Work stream</Th>
              <Th>Confidence</Th>
              <Th>Status</Th>
              <Th>Suggested match</Th>
            </tr>
          </THead>
          <TBody>
            {data.documents.map((document) => (
              <tr key={document.id}>
                <Td>
                  <p className="font-semibold">{document.file_name}</p>
                  <p className="text-xs text-slate-500">{document.mime_type} · {Math.round(document.file_size / 1024)} KB</p>
                </Td>
                <Td>{document.document_type.replaceAll('_', ' ')}</Td>
                <Td>{getWorkStreamName(data, document.work_stream_id)}</Td>
                <Td>{document.parsing_confidence ? `${Math.round(document.parsing_confidence * 100)}%` : 'Pending'}</Td>
                <Td><StatusBadge status={document.review_status} /></Td>
                <Td>{data.transactions.find((transaction) => transaction.linked_document_id === document.id)?.description ?? 'No ledger match yet'}</Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function ReviewQueue({ data }: { data: FinanceData }) {
  const tasks = data.reviewTasks.filter((task) => task.status === 'open');
  const activeTask = tasks[0];
  const transaction = activeTask ? data.transactions.find((item) => item.id === activeTask.transaction_id) : null;
  const document = activeTask ? data.documents.find((item) => item.id === activeTask.document_id) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Keyboard queue</CardTitle>
            <CardDescription>A approve · E edit · L link · S split · R reject.</CardDescription>
          </div>
        </CardHeader>
        <div className="space-y-3">
          {tasks.map((task) => (
            <button key={task.id} className="focus-ring w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left hover:bg-white/[0.06]">
              <div className="flex items-center justify-between">
                <p className="font-bold">{task.task_type.replaceAll('_', ' ')}</p>
                <Badge variant={task.priority === 1 ? 'danger' : 'warning'}>P{task.priority}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-400">{transaction?.description ?? document?.file_name ?? 'Unlinked review item'}</p>
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Side-by-side review</CardTitle>
            <CardDescription>Compare evidence preview against extracted and proposed ledger fields.</CardDescription>
          </div>
        </CardHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-h-80 rounded-3xl border border-white/10 bg-slate-950/70 p-5">
            <div className="flex items-center gap-2 text-slate-300">
              <FileSearch size={18} />
              <p className="font-semibold">Document preview</p>
            </div>
            <div className="mt-5 rounded-2xl bg-white p-5 text-slate-950 shadow-xl">
              <p className="text-xs uppercase tracking-widest text-slate-500">Extracted evidence</p>
              <p className="mt-4 text-2xl font-black">{document?.file_name ?? 'Evidence missing'}</p>
              <p className="mt-4 text-sm">OCR text, PDF page render or CSV row preview appears here.</p>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="font-semibold">Proposed ledger fields</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Description</dt><dd>{transaction?.description ?? 'Create new transaction'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Amount</dt><dd>{formatCurrency(transaction?.amount)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Ownership</dt><dd>{transaction?.ownership_type ?? 'business'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Work stream</dt><dd>{getWorkStreamName(data, transaction?.work_stream_id ?? null)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Business use</dt><dd>{transaction?.business_use_pct ?? 100}%</dd></div>
            </dl>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button><CheckCircle2 size={16} />Approve</Button>
              <Button variant="secondary">Edit fields</Button>
              <Button variant="secondary">Link existing</Button>
              <Button variant="secondary">Split</Button>
              <Button variant="danger" className="col-span-2">Reject extraction</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Bills({ data }: { data: FinanceData }) {
  const detections = detectMonthlyBillsFromBankRows();
  const monthlyFixed = data.bills.reduce((sum, bill) => sum + (bill.amount_estimate ?? 0), 0) + data.subscriptions.reduce((sum, sub) => sum + sub.amount_estimate, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Estimated fixed costs" value={formatCurrency(monthlyFixed)} icon={<CalendarClock />} detail="Bills plus active subscriptions" />
        <MetricCard label="Autopay bills" value={`${data.bills.filter((bill) => bill.autopay).length}`} icon={<CheckCircle2 />} tone="emerald" detail="Expected monthly debits" />
        <MetricCard label="Detected recurring" value={`${detections.length}`} icon={<AlertTriangle />} tone="amber" detail="Needs confirmation" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Upcoming calendar</CardTitle><CardDescription>Recurring bills and late-risk warnings.</CardDescription></div></CardHeader>
          <div className="space-y-3">
            {data.bills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <p className="font-bold">{bill.name}</p>
                  <p className="text-sm text-slate-400">Due day {bill.due_day} · {bill.frequency} · {getAccountName(data, bill.account_id)}</p>
                </div>
                <p className="font-black">{formatCurrency(bill.amount_estimate)}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Subscriptions and detections</CardTitle><CardDescription>Recurring rule suggestions from bank rows.</CardDescription></div></CardHeader>
          <div className="space-y-3">
            {[...data.subscriptions.map((sub) => ({ name: sub.name, amount: sub.amount_estimate, note: `Next ${formatDate(sub.next_due_date)}`, confidence: 1 })), ...detections.map((detected) => ({ name: detected.merchant, amount: detected.averageAmount, note: detected.suggestedAction.replaceAll('_', ' '), confidence: detected.confidence }))].map((item) => (
              <div key={`${item.name}-${item.note}`} className="rounded-2xl bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{item.name}</p>
                  <p className="font-black">{formatCurrency(item.amount)}</p>
                </div>
                <p className="mt-1 text-sm text-slate-400">{item.note} · {Math.round(item.confidence * 100)}% confidence</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Debts({ data }: { data: FinanceData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {data.debts.map((debt) => {
        const paid = (debt.original_balance ?? debt.current_balance) - debt.current_balance;
        const progress = percentage(paid, debt.original_balance ?? debt.current_balance);

        return (
          <Card key={debt.id}>
            <CardHeader>
              <div>
                <CardTitle>{debt.debt_type.replaceAll('_', ' ')}</CardTitle>
                <h3 className="mt-2 text-2xl font-black">{debt.name}</h3>
                <CardDescription>{debt.lender ?? 'No lender'} · due day {debt.due_day ?? 'n/a'}</CardDescription>
              </div>
              <Badge variant="danger">{debt.apr ?? 0}% APR</Badge>
            </CardHeader>
            <p className="text-4xl font-black">{formatCurrency(debt.current_balance)}</p>
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-slate-400">Payoff progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-xs text-slate-400">Minimum payment</p><p className="font-black">{formatCurrency(debt.minimum_payment)}</p></div>
              <div className="rounded-xl bg-white/[0.03] p-3"><p className="text-xs text-slate-400">Original balance</p><p className="font-black">{formatCurrency(debt.original_balance)}</p></div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Budget({ data }: { data: FinanceData }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Monthly planned vs actual</CardTitle>
          <CardDescription>Category budget tracking with personal/business and work-stream views.</CardDescription>
        </div>
      </CardHeader>
      <Table>
        <THead>
          <tr>
            <Th>Month</Th>
            <Th>Category</Th>
            <Th>Work stream</Th>
            <Th>Ownership</Th>
            <Th>Target</Th>
            <Th>Actual</Th>
            <Th>Progress</Th>
          </tr>
        </THead>
        <TBody>
          {data.budgets.map((budget) => {
            const actual = data.transactions
              .filter((transaction) => transaction.category_id === budget.category_id && (budget.work_stream_id ? transaction.work_stream_id === budget.work_stream_id : true))
              .reduce((sum, transaction) => sum + transaction.amount, 0);

            return (
              <tr key={budget.id}>
                <Td>{budget.month_key}</Td>
                <Td>{getCategoryName(data, budget.category_id)}</Td>
                <Td>{getWorkStreamName(data, budget.work_stream_id)}</Td>
                <Td>{budget.ownership_type ?? 'all'}</Td>
                <Td>{formatCurrency(budget.target_amount)}</Td>
                <Td>{formatCurrency(actual)}</Td>
                <Td>
                  <div className="min-w-32">
                    <Progress value={percentage(actual, budget.target_amount)} />
                  </div>
                </Td>
              </tr>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}

function TaxRecords({ data }: { data: FinanceData }) {
  const metrics = getDashboardMetrics(data);
  const summaries = getWorkStreamSummaries(data);
  const taxIncome = data.transactions.filter((txn) => txn.tax_relevant && txn.direction === 'inflow').reduce((sum, txn) => sum + txn.amount, 0);
  const evidenceCount = data.transactions.filter((txn) => txn.tax_relevant && txn.linked_document_id).length;
  const taxRelevantCount = data.transactions.filter((txn) => txn.tax_relevant).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="2025/26 income" value={formatCurrency(taxIncome)} icon={<CircleDollarSign />} tone="emerald" />
        <MetricCard label="Allowable expenses" value={formatCurrency(metrics.taxRelevantExpenses)} icon={<ReceiptText />} tone="amber" />
        <MetricCard label="Evidence coverage" value={`${percentage(evidenceCount, taxRelevantCount)}%`} icon={<ShieldCheck />} tone="cyan" detail={`${evidenceCount}/${taxRelevantCount} tax-relevant items linked`} />
        <MetricCard label="Missing evidence" value={`${metrics.missingEvidence}`} icon={<AlertTriangle />} tone="rose" />
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Export-ready sole trader summary</CardTitle>
            <CardDescription>Work-stream records keep personal and business reporting separate while using one ledger.</CardDescription>
          </div>
          <Button>Export accountant pack</Button>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <Th>Work stream</Th>
              <Th>Income</Th>
              <Th>Allowable expenses</Th>
              <Th>Net</Th>
              <Th>Evidence notes</Th>
            </tr>
          </THead>
          <TBody>
            {summaries.map((summary) => (
              <tr key={summary.code}>
                <Td>{summary.name}</Td>
                <Td>{formatCurrency(summary.income)}</Td>
                <Td>{formatCurrency(summary.expenses)}</Td>
                <Td>{formatCurrency(summary.net)}</Td>
                <Td>{summary.net > 0 ? 'Ready for accountant review' : 'Check category treatment'}</Td>
              </tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

function EmptyLoadingState({ error }: { error: string | null }) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100">
      <Card className="max-w-xl text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-300 text-slate-950">
          <WalletCards />
        </div>
        <h1 className="mt-5 text-2xl font-black">{error ? 'Unable to load finance data' : 'Loading finance workspace'}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {error ?? 'Preparing accounts, transactions, documents, review tasks and reports.'}
        </p>
      </Card>
    </div>
  );
}

function App() {
  const [route, setRouteState] = useState<RouteId>(currentRouteFromHash);
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleHash = () => setRouteState(currentRouteFromHash());
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    loadFinanceData()
      .then(setData)
      .catch((loadError: Error) => setError(loadError.message));
  }, []);

  const screen = useMemo(() => {
    if (!data) {
      return null;
    }

    const screens: Record<RouteId, ReactNode> = {
      dashboard: <Dashboard data={data} />,
      accounts: <Accounts data={data} />,
      transactions: <Transactions data={data} />,
      'work-streams': <WorkStreams data={data} />,
      documents: <Documents data={data} />,
      review: <ReviewQueue data={data} />,
      bills: <Bills data={data} />,
      debts: <Debts data={data} />,
      budget: <Budget data={data} />,
      tax: <TaxRecords data={data} />,
    };

    return screens[route];
  }, [data, route]);

  function setRoute(nextRoute: RouteId) {
    window.location.hash = `/${nextRoute}`;
    setRouteState(nextRoute);
  }

  if (!data || error) {
    return <EmptyLoadingState error={error} />;
  }

  return (
    <Shell route={route} setRoute={setRoute}>
      {screen}
      <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 md:flex-row">
        <span>Unified ledger · evidence traceability · open banking-ready accounts model</span>
        <button className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-400 hover:text-white">
          Architecture notes <ChevronRight size={14} />
        </button>
      </footer>
    </Shell>
  );
}

export default App;
