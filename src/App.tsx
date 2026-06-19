import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useData } from "@/data/DataProvider";
import { DashboardPage } from "@/pages/DashboardPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { AccountDetailPage } from "@/pages/AccountDetailPage";
import { TransactionsPage } from "@/pages/TransactionsPage";
import { WorkStreamsPage } from "@/pages/WorkStreamsPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { ReviewQueuePage } from "@/pages/ReviewQueuePage";
import { BillsPage } from "@/pages/BillsPage";
import { DebtsPage } from "@/pages/DebtsPage";
import { BudgetPage } from "@/pages/BudgetPage";
import { TaxPage } from "@/pages/TaxPage";

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
  );
}
