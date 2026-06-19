/**
 * AQA Finance — domain model.
 *
 * These TypeScript types mirror the Supabase SQL schema in
 * `supabase/migrations`. They are the single source of truth used across the
 * data layer, repositories and UI. Database enum types are represented as
 * string literal unions so they stay in sync with the SQL `CREATE TYPE`
 * statements.
 */

// ----------------------------------------------------------------------------
// Enums (mirror SQL `CREATE TYPE ... AS ENUM`)
// ----------------------------------------------------------------------------

export type AccountType =
  | "current"
  | "savings"
  | "credit_card"
  | "cash"
  | "loan"
  | "tax_pot"
  | "other";

export type WorkStreamCode = "phv" | "trade_plate" | "design" | "freelance" | "other";

export type CategoryKind = "income" | "expense" | "transfer" | "debt" | "savings";

export type TransactionKind =
  | "income"
  | "expense"
  | "transfer"
  | "debt_payment"
  | "savings"
  | "adjustment";

export type OwnershipType = "personal" | "business" | "mixed";

export type Direction = "inflow" | "outflow";

export type ReconciliationStatus = "unreconciled" | "matched" | "reconciled" | "ignored";

export type ReviewStatus = "none" | "needs_review" | "in_review" | "approved" | "rejected";

export type DocumentSourceType = "upload" | "email" | "import";

export type DocumentType =
  | "receipt"
  | "invoice_sent"
  | "invoice_received"
  | "weekly_statement"
  | "operator_statement"
  | "bank_statement"
  | "payout_report"
  | "screenshot"
  | "mileage_log"
  | "unknown";

export type ProcessingStatus =
  | "pending"
  | "queued"
  | "processing"
  | "extracted"
  | "needs_review"
  | "completed"
  | "failed";

export type BillFrequency = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

export type BillingCycle = "weekly" | "monthly" | "yearly";

export type DebtType = "credit_card" | "loan" | "car_finance" | "tax" | "bnpl" | "other";

export type DebtStatus = "active" | "paid_off" | "default" | "closed";

export type SavingsGoalType =
  | "emergency_fund"
  | "tax_pot"
  | "sinking_fund"
  | "vehicle"
  | "holiday"
  | "other";

export type RuleType =
  | "merchant"
  | "keyword"
  | "recurring"
  | "work_stream"
  | "category"
  | "bill_match"
  | "debt_match"
  | "transfer_match";

export type ReviewTaskType =
  | "document_extraction"
  | "low_confidence_match"
  | "duplicate_upload"
  | "missing_evidence"
  | "unreconciled_transaction"
  | "tax_pot_suggestion"
  | "anomaly";

export type ReviewTaskStatus = "open" | "in_progress" | "done" | "dismissed";

export type Priority = "low" | "medium" | "high";

export type AuditAction = "create" | "update" | "delete" | "approve" | "reject" | "import";

// ----------------------------------------------------------------------------
// Tables
// ----------------------------------------------------------------------------

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  provider: string | null;
  currency: string; // default GBP
  opening_balance: number | null;
  current_balance: number | null;
  last4: string | null;
  active: boolean;
  created_at: string;
}

export interface WorkStream {
  id: string;
  user_id: string;
  code: WorkStreamCode;
  name: string;
  active: boolean;
  created_at: string;
}

export interface TransactionCategory {
  id: string;
  user_id: string | null;
  kind: CategoryKind;
  name: string;
  code: string;
  parent_id: string | null;
  sort_order: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  work_stream_id: string | null;
  category_id: string | null;
  transaction_date: string;
  posted_date: string | null;
  kind: TransactionKind;
  ownership_type: OwnershipType;
  counterparty: string | null;
  description: string;
  amount: number;
  direction: Direction;
  currency: string;
  business_use_pct: number; // default 100
  tax_relevant: boolean;
  recurring_rule_id: string | null;
  linked_document_id: string | null;
  linked_bill_id: string | null;
  linked_debt_id: string | null;
  transfer_group_id: string | null;
  reconciliation_status: ReconciliationStatus;
  review_status: ReviewStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** A split allocates part of a transaction to a category / business-use %. */
export interface TransactionSplit {
  id: string;
  transaction_id: string;
  category_id: string | null;
  work_stream_id: string | null;
  ownership_type: OwnershipType;
  amount: number;
  business_use_pct: number;
  notes: string | null;
}

export interface DocumentRecord {
  id: string;
  user_id: string;
  work_stream_id: string | null;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path_original: string;
  storage_path_preview: string | null;
  source_type: DocumentSourceType;
  document_type: DocumentType;
  checksum: string;
  uploaded_at: string;
  processing_status: ProcessingStatus;
  parsing_confidence: number | null;
  review_status: ReviewStatus;
  notes: string | null;
}

export interface DocumentPage {
  id: string;
  document_id: string;
  page_number: number;
  extracted_text: string | null;
  preview_path: string | null;
}

export interface Extraction {
  id: string;
  document_id: string;
  extractor_version: string;
  raw_text: string | null;
  raw_json: ExtractionRawJson;
  normalized_json: NormalizedExtraction;
  confidence_score: number;
  created_at: string;
}

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  category_id: string | null;
  amount_estimate: number | null;
  due_day: number | null;
  frequency: BillFrequency;
  account_id: string | null;
  autopay: boolean;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount_estimate: number;
  billing_cycle: BillingCycle;
  next_due_date: string | null;
  category_id: string | null;
  account_id: string | null;
  active: boolean;
  created_at: string;
}

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  debt_type: DebtType;
  lender: string | null;
  account_id: string | null;
  original_balance: number | null;
  current_balance: number;
  apr: number | null;
  minimum_payment: number | null;
  due_day: number | null;
  status: DebtStatus;
  created_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  transaction_id: string | null;
  payment_date: string;
  amount: number;
  principal_amount: number | null;
  interest_amount: number | null;
  fees_amount: number | null;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number | null;
  current_amount: number;
  linked_account_id: string | null;
  goal_type: SavingsGoalType;
  target_date: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  month_key: string;
  category_id: string | null;
  work_stream_id: string | null;
  ownership_type: OwnershipType | null;
  target_amount: number;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  user_id: string;
  account_id: string;
  txn_date: string;
  description: string;
  amount: number;
  direction: Direction;
  balance: number | null;
  source_document_id: string | null;
  matched_transaction_id: string | null;
  reconciliation_status: ReconciliationStatus;
  created_at: string;
}

export interface Rule {
  id: string;
  user_id: string;
  rule_type: RuleType;
  name: string;
  conditions_json: RuleConditions;
  actions_json: RuleActions;
  active: boolean;
  created_at: string;
}

export interface ReviewTask {
  id: string;
  user_id: string;
  document_id: string | null;
  transaction_id: string | null;
  task_type: ReviewTaskType;
  priority: Priority;
  status: ReviewTaskStatus;
  payload_json: ReviewTaskPayload;
  created_at: string;
  completed_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// JSON payload shapes (kept typed rather than `any`)
// ----------------------------------------------------------------------------

export interface ExtractionRawJson {
  detected_document_type: DocumentType;
  ocr_engine?: string;
  parser?: string;
  pages?: number;
  blocks?: Array<{ text: string; confidence: number }>;
  [key: string]: unknown;
}

export interface NormalizedLineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  amount: number;
}

export interface NormalizedExtraction {
  document_type: DocumentType;
  supplier?: string | null;
  date?: string | null;
  total?: number | null;
  net?: number | null;
  vat_amount?: number | null;
  vat_rate?: number | null;
  currency?: string;
  statement_period_start?: string | null;
  statement_period_end?: string | null;
  work_stream_hint?: WorkStreamCode | null;
  suggested_category_code?: string | null;
  direction_hint?: Direction | null;
  line_items?: NormalizedLineItem[];
  /** For bank/operator statements: parsed transaction rows. */
  transactions?: Array<{
    date: string;
    description: string;
    amount: number;
    direction: Direction;
    balance?: number | null;
  }>;
  confidence_breakdown?: Record<string, number>;
}

export interface RuleConditions {
  merchant_contains?: string[];
  description_contains?: string[];
  amount_min?: number;
  amount_max?: number;
  account_id?: string;
  source_document_type?: DocumentType;
}

export interface RuleActions {
  set_category_code?: string;
  set_work_stream_code?: WorkStreamCode;
  set_ownership_type?: OwnershipType;
  set_tax_relevant?: boolean;
  set_business_use_pct?: number;
  link_bill_id?: string;
  link_debt_id?: string;
}

export interface ReviewTaskPayload {
  summary: string;
  suggested_action?: string;
  suggestion?: NormalizedExtraction;
  candidate_transaction_ids?: string[];
  amount?: number;
  [key: string]: unknown;
}

// ----------------------------------------------------------------------------
// Derived / view models used by the UI
// ----------------------------------------------------------------------------

export interface DashboardSummary {
  totalCash: number;
  moneyInThisMonth: number;
  moneyOutThisMonth: number;
  debtTotal: number;
  taxPotBalance: number;
  upcomingBills: Array<{ bill: Bill; dueDate: string; amount: number }>;
  savingsGoals: SavingsGoal[];
  recentTransactions: Transaction[];
  reviewItems: number;
  workStreamSummary: WorkStreamSummary[];
  netWorth: number;
}

export interface WorkStreamSummary {
  workStream: WorkStream;
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
}

export interface TaxYearSummary {
  taxYear: string; // e.g. "2025/26"
  start: string;
  end: string;
  totalIncome: number;
  totalAllowableExpenses: number;
  estimatedProfit: number;
  byWorkStream: WorkStreamSummary[];
  taxRelevantWithoutEvidence: Transaction[];
  evidenceCoveragePct: number;
}
