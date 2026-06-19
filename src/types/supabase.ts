/**
 * Supabase database typing.
 *
 * In a live project you would generate this with:
 *   `supabase gen types typescript --project-id <id> > src/types/supabase.ts`
 *
 * Here we hand-author it from the domain model so the typed Supabase client
 * (`createClient<Database>`) stays aligned with `supabase/migrations`.
 */
import type {
  Account,
  AuditLogEntry,
  BankTransaction,
  Bill,
  Budget,
  Debt,
  DebtPayment,
  DocumentPage,
  DocumentRecord,
  Extraction,
  Profile,
  ReviewTask,
  Rule,
  SavingsGoal,
  Subscription,
  Transaction,
  TransactionCategory,
  TransactionSplit,
  WorkStream,
} from "./domain";

type TableShape<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableShape<Profile>;
      accounts: TableShape<Account>;
      work_streams: TableShape<WorkStream>;
      transaction_categories: TableShape<TransactionCategory>;
      transactions: TableShape<Transaction>;
      transaction_splits: TableShape<TransactionSplit>;
      documents: TableShape<DocumentRecord>;
      document_pages: TableShape<DocumentPage>;
      extractions: TableShape<Extraction>;
      bills: TableShape<Bill>;
      subscriptions: TableShape<Subscription>;
      debts: TableShape<Debt>;
      debt_payments: TableShape<DebtPayment>;
      savings_goals: TableShape<SavingsGoal>;
      budgets: TableShape<Budget>;
      bank_transactions: TableShape<BankTransaction>;
      rules: TableShape<Rule>;
      review_tasks: TableShape<ReviewTask>;
      audit_log: TableShape<AuditLogEntry>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
