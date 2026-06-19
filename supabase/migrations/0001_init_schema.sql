-- =============================================================================
-- AQA Finance — initial schema
-- UK personal finance & self-employed (sole trader) money management.
--
-- Design notes:
--   * One unified `transactions` ledger for all money movement.
--   * `bank_transactions` holds raw imported/statement rows that are matched
--     into the ledger (keeps source data immutable & auditable).
--   * Raw OCR/parse output lives in `extractions`, kept separate from approved
--     `transactions` so evidence is traceable but never silently overwrites
--     user-approved data.
--   * Every user-owned table carries `user_id` for row-level security.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type account_type as enum
  ('current', 'savings', 'credit_card', 'cash', 'loan', 'tax_pot', 'other');

create type work_stream_code as enum
  ('phv', 'trade_plate', 'design', 'freelance', 'other');

create type category_kind as enum
  ('income', 'expense', 'transfer', 'debt', 'savings');

create type transaction_kind as enum
  ('income', 'expense', 'transfer', 'debt_payment', 'savings', 'adjustment');

create type ownership_type as enum ('personal', 'business', 'mixed');

create type direction as enum ('inflow', 'outflow');

create type reconciliation_status as enum
  ('unreconciled', 'matched', 'reconciled', 'ignored');

create type review_status as enum
  ('none', 'needs_review', 'in_review', 'approved', 'rejected');

create type document_source_type as enum ('upload', 'email', 'import');

create type document_type as enum
  ('receipt', 'invoice_sent', 'invoice_received', 'weekly_statement',
   'operator_statement', 'bank_statement', 'payout_report', 'screenshot',
   'mileage_log', 'unknown');

create type processing_status as enum
  ('pending', 'queued', 'processing', 'extracted', 'needs_review',
   'completed', 'failed');

create type bill_frequency as enum
  ('weekly', 'monthly', 'quarterly', 'yearly', 'custom');

create type billing_cycle as enum ('weekly', 'monthly', 'yearly');

create type debt_type as enum
  ('credit_card', 'loan', 'car_finance', 'tax', 'bnpl', 'other');

create type debt_status as enum ('active', 'paid_off', 'default', 'closed');

create type savings_goal_type as enum
  ('emergency_fund', 'tax_pot', 'sinking_fund', 'vehicle', 'holiday', 'other');

create type rule_type as enum
  ('merchant', 'keyword', 'recurring', 'work_stream', 'category',
   'bill_match', 'debt_match', 'transfer_match');

create type review_task_type as enum
  ('document_extraction', 'low_confidence_match', 'duplicate_upload',
   'missing_evidence', 'unreconciled_transaction', 'tax_pot_suggestion',
   'anomaly');

create type review_task_status as enum ('open', 'in_progress', 'done', 'dismissed');

create type priority as enum ('low', 'medium', 'high');

create type audit_action as enum
  ('create', 'update', 'delete', 'approve', 'reject', 'import');

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- accounts
-- ----------------------------------------------------------------------------
create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  account_type account_type not null default 'current',
  provider text,
  currency text not null default 'GBP',
  opening_balance numeric(14, 2),
  current_balance numeric(14, 2),
  last4 text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint last4_format check (last4 is null or last4 ~ '^[0-9]{4}$')
);
create index accounts_user_id_idx on accounts (user_id);
create index accounts_user_active_idx on accounts (user_id, active);

-- ----------------------------------------------------------------------------
-- work_streams
-- ----------------------------------------------------------------------------
create table work_streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code work_stream_code not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);
create index work_streams_user_id_idx on work_streams (user_id);

-- ----------------------------------------------------------------------------
-- transaction_categories  (system defaults have user_id = null)
-- ----------------------------------------------------------------------------
create table transaction_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  kind category_kind not null,
  name text not null,
  code text not null,
  parent_id uuid references transaction_categories (id) on delete set null,
  sort_order integer not null default 0
);
create index categories_user_id_idx on transaction_categories (user_id);
create index categories_kind_idx on transaction_categories (kind);
create unique index categories_user_code_uidx
  on transaction_categories (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

-- ----------------------------------------------------------------------------
-- documents (evidence — original files never mutated)
-- ----------------------------------------------------------------------------
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  work_stream_id uuid references work_streams (id) on delete set null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null default 0,
  storage_path_original text not null,
  storage_path_preview text,
  source_type document_source_type not null default 'upload',
  document_type document_type not null default 'unknown',
  checksum text not null,
  uploaded_at timestamptz not null default now(),
  processing_status processing_status not null default 'pending',
  parsing_confidence numeric(5, 4),
  review_status review_status not null default 'none',
  notes text
);
create index documents_user_id_idx on documents (user_id);
create index documents_status_idx on documents (user_id, processing_status);
create index documents_checksum_idx on documents (user_id, checksum);

-- ----------------------------------------------------------------------------
-- document_pages
-- ----------------------------------------------------------------------------
create table document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  page_number integer not null,
  extracted_text text,
  preview_path text,
  unique (document_id, page_number)
);
create index document_pages_document_idx on document_pages (document_id);

-- ----------------------------------------------------------------------------
-- extractions (raw + normalized OCR/parse output, kept separate from ledger)
-- ----------------------------------------------------------------------------
create table extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  extractor_version text not null,
  raw_text text,
  raw_json jsonb not null default '{}'::jsonb,
  normalized_json jsonb not null default '{}'::jsonb,
  confidence_score numeric(5, 4) not null default 0,
  created_at timestamptz not null default now()
);
create index extractions_document_idx on extractions (document_id);

-- ----------------------------------------------------------------------------
-- bills
-- ----------------------------------------------------------------------------
create table bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category_id uuid references transaction_categories (id) on delete set null,
  amount_estimate numeric(14, 2),
  due_day integer check (due_day is null or (due_day between 1 and 31)),
  frequency bill_frequency not null default 'monthly',
  account_id uuid references accounts (id) on delete set null,
  autopay boolean not null default false,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create index bills_user_id_idx on bills (user_id);

-- ----------------------------------------------------------------------------
-- subscriptions
-- ----------------------------------------------------------------------------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount_estimate numeric(14, 2) not null default 0,
  billing_cycle billing_cycle not null default 'monthly',
  next_due_date date,
  category_id uuid references transaction_categories (id) on delete set null,
  account_id uuid references accounts (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index subscriptions_user_id_idx on subscriptions (user_id);

-- ----------------------------------------------------------------------------
-- debts
-- ----------------------------------------------------------------------------
create table debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  debt_type debt_type not null default 'other',
  lender text,
  account_id uuid references accounts (id) on delete set null,
  original_balance numeric(14, 2),
  current_balance numeric(14, 2) not null default 0,
  apr numeric(6, 3),
  minimum_payment numeric(14, 2),
  due_day integer check (due_day is null or (due_day between 1 and 31)),
  status debt_status not null default 'active',
  created_at timestamptz not null default now()
);
create index debts_user_id_idx on debts (user_id);

-- ----------------------------------------------------------------------------
-- debt_payments
-- ----------------------------------------------------------------------------
create table debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references debts (id) on delete cascade,
  transaction_id uuid,
  payment_date date not null,
  amount numeric(14, 2) not null,
  principal_amount numeric(14, 2),
  interest_amount numeric(14, 2),
  fees_amount numeric(14, 2),
  created_at timestamptz not null default now()
);
create index debt_payments_debt_idx on debt_payments (debt_id);

-- ----------------------------------------------------------------------------
-- savings_goals
-- ----------------------------------------------------------------------------
create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2),
  current_amount numeric(14, 2) not null default 0,
  linked_account_id uuid references accounts (id) on delete set null,
  goal_type savings_goal_type not null default 'other',
  target_date date,
  created_at timestamptz not null default now()
);
create index savings_goals_user_id_idx on savings_goals (user_id);

-- ----------------------------------------------------------------------------
-- budgets
-- ----------------------------------------------------------------------------
create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  category_id uuid references transaction_categories (id) on delete cascade,
  work_stream_id uuid references work_streams (id) on delete cascade,
  ownership_type ownership_type,
  target_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index budgets_user_month_idx on budgets (user_id, month_key);

-- ----------------------------------------------------------------------------
-- transactions (unified ledger)
-- ----------------------------------------------------------------------------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references accounts (id) on delete set null,
  work_stream_id uuid references work_streams (id) on delete set null,
  category_id uuid references transaction_categories (id) on delete set null,
  transaction_date date not null,
  posted_date date,
  kind transaction_kind not null default 'expense',
  ownership_type ownership_type not null default 'personal',
  counterparty text,
  description text not null default '',
  amount numeric(14, 2) not null,
  direction direction not null,
  currency text not null default 'GBP',
  business_use_pct numeric(5, 2) not null default 100
    check (business_use_pct between 0 and 100),
  tax_relevant boolean not null default false,
  recurring_rule_id uuid references rules (id) on delete set null,
  linked_document_id uuid references documents (id) on delete set null,
  linked_bill_id uuid references bills (id) on delete set null,
  linked_debt_id uuid references debts (id) on delete set null,
  transfer_group_id uuid,
  reconciliation_status reconciliation_status not null default 'unreconciled',
  review_status review_status not null default 'none',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint amount_nonneg check (amount >= 0)
);
create index transactions_user_id_idx on transactions (user_id);
create index transactions_account_idx on transactions (account_id);
create index transactions_work_stream_idx on transactions (work_stream_id);
create index transactions_category_idx on transactions (category_id);
create index transactions_date_idx on transactions (user_id, transaction_date desc);
create index transactions_review_idx on transactions (user_id, review_status);
create index transactions_tax_idx on transactions (user_id, tax_relevant);
create index transactions_transfer_group_idx on transactions (transfer_group_id);
create index transactions_recon_idx on transactions (user_id, reconciliation_status);

-- FK references that pointed forward
alter table debt_payments
  add constraint debt_payments_transaction_fk
  foreign key (transaction_id) references transactions (id) on delete set null;

-- ----------------------------------------------------------------------------
-- transaction_splits (split one txn across categories / business-use %)
-- ----------------------------------------------------------------------------
create table transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions (id) on delete cascade,
  category_id uuid references transaction_categories (id) on delete set null,
  work_stream_id uuid references work_streams (id) on delete set null,
  ownership_type ownership_type not null default 'personal',
  amount numeric(14, 2) not null,
  business_use_pct numeric(5, 2) not null default 100
    check (business_use_pct between 0 and 100),
  notes text
);
create index transaction_splits_txn_idx on transaction_splits (transaction_id);

-- ----------------------------------------------------------------------------
-- bank_transactions (raw imported rows -> matched to ledger)
-- ----------------------------------------------------------------------------
create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references accounts (id) on delete cascade,
  txn_date date not null,
  description text not null default '',
  amount numeric(14, 2) not null,
  direction direction not null,
  balance numeric(14, 2),
  source_document_id uuid references documents (id) on delete set null,
  matched_transaction_id uuid references transactions (id) on delete set null,
  reconciliation_status reconciliation_status not null default 'unreconciled',
  created_at timestamptz not null default now()
);
create index bank_transactions_user_idx on bank_transactions (user_id);
create index bank_transactions_account_idx on bank_transactions (account_id, txn_date desc);
create index bank_transactions_recon_idx on bank_transactions (user_id, reconciliation_status);

-- ----------------------------------------------------------------------------
-- rules (automation: merchant/keyword/work-stream/category/match rules)
-- ----------------------------------------------------------------------------
create table rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_type rule_type not null,
  name text not null,
  conditions_json jsonb not null default '{}'::jsonb,
  actions_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index rules_user_id_idx on rules (user_id);

-- recurring_rule_id forward reference now resolvable
alter table transactions
  drop constraint if exists transactions_recurring_rule_id_fkey;
alter table transactions
  add constraint transactions_recurring_rule_id_fkey
  foreign key (recurring_rule_id) references rules (id) on delete set null;

-- ----------------------------------------------------------------------------
-- review_tasks
-- ----------------------------------------------------------------------------
create table review_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid references documents (id) on delete cascade,
  transaction_id uuid references transactions (id) on delete cascade,
  task_type review_task_type not null,
  priority priority not null default 'medium',
  status review_task_status not null default 'open',
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index review_tasks_user_idx on review_tasks (user_id, status);

-- ----------------------------------------------------------------------------
-- audit_log
-- ----------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action audit_action not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_user_idx on audit_log (user_id, created_at desc);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger for transactions
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger transactions_set_updated_at
  before update on transactions
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- New-user bootstrap: create profile row on signup
-- ----------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
