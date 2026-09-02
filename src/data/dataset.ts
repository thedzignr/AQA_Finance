import type {
  Account,
  AuditLogEntry,
  BankTransaction,
  Bill,
  Budget,
  Client,
  CompanyProfile,
  Debt,
  DebtPayment,
  DocumentPage,
  DocumentRecord,
  Extraction,
  Invoice,
  OperatingCost,
  Profile,
  Quote,
  ReviewTask,
  Rule,
  SavingsGoal,
  Subscription,
  Transaction,
  TransactionCategory,
  TransactionSplit,
  WorkEntry,
  WorkStream,
} from "@/types/domain";

/**
 * The full in-memory shape of a user's financial data. Both the mock and the
 * Supabase repositories load/persist against this structure so the UI is
 * backend-agnostic.
 */
export interface Dataset {
  profile: Profile | null;
  accounts: Account[];
  workStreams: WorkStream[];
  categories: TransactionCategory[];
  transactions: Transaction[];
  transactionSplits: TransactionSplit[];
  documents: DocumentRecord[];
  documentPages: DocumentPage[];
  extractions: Extraction[];
  bills: Bill[];
  subscriptions: Subscription[];
  operatingCosts: OperatingCost[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  savingsGoals: SavingsGoal[];
  budgets: Budget[];
  bankTransactions: BankTransaction[];
  rules: Rule[];
  reviewTasks: ReviewTask[];
  auditLog: AuditLogEntry[];
  companyProfiles: CompanyProfile[];
  clients: Client[];
  quotes: Quote[];
  invoices: Invoice[];
  workEntries: WorkEntry[];
}

/** Maps a Dataset key to its element type — used by the generic repository. */
export interface CollectionMap {
  accounts: Account;
  workStreams: WorkStream;
  categories: TransactionCategory;
  transactions: Transaction;
  transactionSplits: TransactionSplit;
  documents: DocumentRecord;
  documentPages: DocumentPage;
  extractions: Extraction;
  bills: Bill;
  subscriptions: Subscription;
  operatingCosts: OperatingCost;
  debts: Debt;
  debtPayments: DebtPayment;
  savingsGoals: SavingsGoal;
  budgets: Budget;
  bankTransactions: BankTransaction;
  rules: Rule;
  reviewTasks: ReviewTask;
  auditLog: AuditLogEntry;
  companyProfiles: CompanyProfile;
  clients: Client;
  quotes: Quote;
  invoices: Invoice;
  workEntries: WorkEntry;
}

export type CollectionName = keyof CollectionMap;

/** Database table name for each collection (mock <-> Supabase mapping). */
export const COLLECTION_TABLE: Record<CollectionName, string> = {
  accounts: "accounts",
  workStreams: "work_streams",
  categories: "transaction_categories",
  transactions: "transactions",
  transactionSplits: "transaction_splits",
  documents: "documents",
  documentPages: "document_pages",
  extractions: "extractions",
  bills: "bills",
  subscriptions: "subscriptions",
  operatingCosts: "operating_costs",
  debts: "debts",
  debtPayments: "debt_payments",
  savingsGoals: "savings_goals",
  budgets: "budgets",
  bankTransactions: "bank_transactions",
  rules: "rules",
  reviewTasks: "review_tasks",
  auditLog: "audit_log",
  companyProfiles: "company_profiles",
  clients: "clients",
  quotes: "quotes",
  invoices: "invoices",
  workEntries: "work_entries",
};

export function emptyDataset(): Dataset {
  return {
    profile: null,
    accounts: [],
    workStreams: [],
    categories: [],
    transactions: [],
    transactionSplits: [],
    documents: [],
    documentPages: [],
    extractions: [],
    bills: [],
    subscriptions: [],
    operatingCosts: [],
    debts: [],
    debtPayments: [],
    savingsGoals: [],
    budgets: [],
    bankTransactions: [],
    rules: [],
    reviewTasks: [],
    auditLog: [],
    companyProfiles: [],
    clients: [],
    quotes: [],
    invoices: [],
    workEntries: [],
  };
}
