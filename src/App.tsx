import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useData } from "@/data/DataProvider";

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

function PageFallback() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export function App() {
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
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/:accountId" element={<AccountDetailPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="work-streams" element={<WorkStreamsPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="review" element={<ReviewQueuePage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="debts" element={<DebtsPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="tax" element={<TaxPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
