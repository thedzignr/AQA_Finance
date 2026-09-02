import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DataProvider, useData } from "@/data/DataProvider";
import { useAuth } from "@/data/auth";
import { LoginPage } from "@/pages/LoginPage";

// Route-level code-splitting keeps the initial bundle lean; each screen and its
// charts load on demand.
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const AccountsPage = lazy(() =>
  import("@/pages/AccountsPage").then((m) => ({ default: m.AccountsPage })),
);
const AccountDetailPage = lazy(() =>
  import("@/pages/AccountDetailPage").then((m) => ({ default: m.AccountDetailPage })),
);
const TransactionsPage = lazy(() =>
  import("@/pages/TransactionsPage").then((m) => ({ default: m.TransactionsPage })),
);
const WorkStreamsPage = lazy(() =>
  import("@/pages/WorkStreamsPage").then((m) => ({ default: m.WorkStreamsPage })),
);
const DocumentsPage = lazy(() =>
  import("@/pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })),
);
const ReviewQueuePage = lazy(() =>
  import("@/pages/ReviewQueuePage").then((m) => ({ default: m.ReviewQueuePage })),
);
const BillsPage = lazy(() =>
  import("@/pages/BillsPage").then((m) => ({ default: m.BillsPage })),
);
const DebtsPage = lazy(() =>
  import("@/pages/DebtsPage").then((m) => ({ default: m.DebtsPage })),
);
const BudgetPage = lazy(() =>
  import("@/pages/BudgetPage").then((m) => ({ default: m.BudgetPage })),
);
const TaxPage = lazy(() =>
  import("@/pages/TaxPage").then((m) => ({ default: m.TaxPage })),
);
const RunningCostsPage = lazy(() =>
  import("@/pages/RunningCostsPage").then((m) => ({ default: m.RunningCostsPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const ClientsPage = lazy(() =>
  import("@/pages/ClientsPage").then((m) => ({ default: m.ClientsPage })),
);
const QuotesPage = lazy(() =>
  import("@/pages/QuotesPage").then((m) => ({ default: m.QuotesPage })),
);
const InvoicesPage = lazy(() =>
  import("@/pages/InvoicesPage").then((m) => ({ default: m.InvoicesPage })),
);
const WorkLogPage = lazy(() =>
  import("@/pages/WorkLogPage").then((m) => ({ default: m.WorkLogPage })),
);
const PrintDocumentPage = lazy(() =>
  import("@/pages/PrintDocumentPage").then((m) => ({ default: m.PrintDocumentPage })),
);

function PageFallback() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
      {children}
    </div>
  );
}

export function App() {
  const { configured, loading: authLoading, session } = useAuth();

  if (!configured) {
    return (
      <FullScreen>
        <p className="text-lg font-semibold text-foreground">Connect Supabase to continue</p>
        <p className="max-w-md text-sm">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your
          environment, then reload. The app stores your data in your own Supabase project.
        </p>
      </FullScreen>
    );
  }

  if (authLoading) {
    return (
      <FullScreen>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </FullScreen>
    );
  }

  if (!session) return <LoginPage />;

  return (
    <DataProvider>
      <AuthedApp />
    </DataProvider>
  );
}

function AuthedApp() {
  const { loading, error, data } = useData();

  if (loading && data.accounts.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Loading your finances…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold text-destructive">Couldn’t load data</p>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="print/invoice/:id" element={<PrintDocumentPage kind="invoice" />} />
      <Route path="print/quote/:id" element={<PrintDocumentPage kind="quote" />} />
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/:accountId" element={<AccountDetailPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="work-streams" element={<WorkStreamsPage />} />
        <Route path="work-log" element={<WorkLogPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="quotes" element={<QuotesPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="review" element={<ReviewQueuePage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="debts" element={<DebtsPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="running-costs" element={<RunningCostsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="tax" element={<TaxPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
