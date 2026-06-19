export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AccountType = 'current' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'tax_pot' | 'other';
export type CategoryKind = 'income' | 'expense' | 'transfer' | 'debt' | 'savings';
export type TransactionKind = 'income' | 'expense' | 'transfer' | 'debt_payment' | 'savings' | 'adjustment';
export type OwnershipType = 'personal' | 'business' | 'mixed';
export type MoneyDirection = 'inflow' | 'outflow';
export type DocumentSourceType = 'upload' | 'email' | 'import';
export type DocumentType =
  | 'receipt'
  | 'invoice_sent'
  | 'invoice_received'
  | 'weekly_statement'
  | 'operator_statement'
  | 'bank_statement'
  | 'payout_report'
  | 'screenshot'
  | 'mileage_log'
  | 'unknown';
export type ProcessingStatus = 'queued' | 'processing' | 'parsed' | 'matched' | 'failed';
export type ReviewStatus = 'not_required' | 'needs_review' | 'approved' | 'rejected';
export type ReconciliationStatus = 'unreconciled' | 'suggested_match' | 'reconciled' | 'ignored';
export type BillFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type BillingCycle = 'weekly' | 'monthly' | 'yearly';
export type DebtType = 'credit_card' | 'loan' | 'car_finance' | 'tax' | 'bnpl' | 'other';
export type DebtStatus = 'active' | 'paid_off' | 'paused' | 'defaulted';
export type SavingsGoalType = 'emergency_fund' | 'tax_pot' | 'sinking_fund' | 'vehicle' | 'holiday' | 'other';
export type RuleType =
  | 'merchant'
  | 'keyword'
  | 'recurring'
  | 'work_stream'
  | 'category'
  | 'bill_match'
  | 'debt_match'
  | 'transfer_match';
export type ReviewTaskStatus = 'open' | 'in_progress' | 'completed' | 'dismissed';

export type RowWithTimestamps = {
  created_at: string;
};

export type Profile = RowWithTimestamps & {
  id: string;
  full_name: string | null;
  email: string;
};

export type Account = RowWithTimestamps & {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  provider: string | null;
  currency: string;
  opening_balance: number | null;
  current_balance: number | null;
  last4: string | null;
  active: boolean;
};

export type WorkStream = RowWithTimestamps & {
  id: string;
  user_id: string;
  code: 'phv' | 'trade_plate' | 'design' | 'freelance' | 'other';
  name: string;
  active: boolean;
};

export type TransactionCategory = {
  id: string;
  user_id: string | null;
  kind: CategoryKind;
  name: string;
  code: string;
  parent_id: string | null;
  sort_order: number;
};

export type Transaction = RowWithTimestamps & {
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
  direction: MoneyDirection;
  currency: string;
  business_use_pct: number;
  tax_relevant: boolean;
  recurring_rule_id: string | null;
  linked_document_id: string | null;
  linked_bill_id: string | null;
  linked_debt_id: string | null;
  transfer_group_id: string | null;
  reconciliation_status: ReconciliationStatus;
  review_status: ReviewStatus;
  notes: string | null;
  updated_at: string;
};

export type TransactionSplit = RowWithTimestamps & {
  id: string;
  transaction_id: string;
  category_id: string | null;
  work_stream_id: string | null;
  ownership_type: OwnershipType;
  amount: number;
  business_use_pct: number;
  tax_relevant: boolean;
  notes: string | null;
};

export type Document = {
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
};

export type DocumentPage = {
  id: string;
  document_id: string;
  page_number: number;
  extracted_text: string | null;
  preview_path: string | null;
};

export type Extraction = RowWithTimestamps & {
  id: string;
  document_id: string;
  extractor_version: string;
  raw_text: string | null;
  raw_json: Json;
  normalized_json: Json;
  confidence_score: number;
};

export type Bill = RowWithTimestamps & {
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
};

export type Subscription = RowWithTimestamps & {
  id: string;
  user_id: string;
  name: string;
  amount_estimate: number;
  billing_cycle: BillingCycle;
  next_due_date: string | null;
  category_id: string | null;
  account_id: string | null;
  active: boolean;
};

export type Debt = RowWithTimestamps & {
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
};

export type DebtPayment = RowWithTimestamps & {
  id: string;
  debt_id: string;
  transaction_id: string | null;
  payment_date: string;
  amount: number;
  principal_amount: number | null;
  interest_amount: number | null;
  fees_amount: number | null;
};

export type SavingsGoal = RowWithTimestamps & {
  id: string;
  user_id: string;
  name: string;
  target_amount: number | null;
  current_amount: number;
  linked_account_id: string | null;
  goal_type: SavingsGoalType;
  target_date: string | null;
};

export type Budget = RowWithTimestamps & {
  id: string;
  user_id: string;
  month_key: string;
  category_id: string | null;
  work_stream_id: string | null;
  ownership_type: OwnershipType | null;
  target_amount: number;
};

export type BankTransaction = RowWithTimestamps & {
  id: string;
  user_id: string;
  account_id: string;
  txn_date: string;
  description: string;
  amount: number;
  direction: MoneyDirection;
  balance: number | null;
  source_document_id: string | null;
  matched_transaction_id: string | null;
  reconciliation_status: ReconciliationStatus;
};

export type Rule = RowWithTimestamps & {
  id: string;
  user_id: string;
  rule_type: RuleType;
  name: string;
  conditions_json: Json;
  actions_json: Json;
  active: boolean;
};

export type ReviewTask = RowWithTimestamps & {
  id: string;
  user_id: string;
  document_id: string | null;
  transaction_id: string | null;
  task_type: string;
  priority: number;
  status: ReviewTaskStatus;
  payload_json: Json;
  completed_at: string | null;
};

export type AuditLog = RowWithTimestamps & {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before_json: Json | null;
  after_json: Json | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile };
      accounts: { Row: Account };
      work_streams: { Row: WorkStream };
      transaction_categories: { Row: TransactionCategory };
      transactions: { Row: Transaction };
      transaction_splits: { Row: TransactionSplit };
      documents: { Row: Document };
      document_pages: { Row: DocumentPage };
      extractions: { Row: Extraction };
      bills: { Row: Bill };
      subscriptions: { Row: Subscription };
      debts: { Row: Debt };
      debt_payments: { Row: DebtPayment };
      savings_goals: { Row: SavingsGoal };
      budgets: { Row: Budget };
      bank_transactions: { Row: BankTransaction };
      rules: { Row: Rule };
      review_tasks: { Row: ReviewTask };
      audit_log: { Row: AuditLog };
    };
    Enums: {
      account_type: AccountType;
      category_kind: CategoryKind;
      transaction_kind: TransactionKind;
      ownership_type: OwnershipType;
      money_direction: MoneyDirection;
      document_type: DocumentType;
      processing_status: ProcessingStatus;
      review_status: ReviewStatus;
      reconciliation_status: ReconciliationStatus;
      bill_frequency: BillFrequency;
      billing_cycle: BillingCycle;
      debt_type: DebtType;
      debt_status: DebtStatus;
      savings_goal_type: SavingsGoalType;
      rule_type: RuleType;
      review_task_status: ReviewTaskStatus;
    };
  };
};
