
-- ============================================================
-- 0001_init_schema.sql
-- ============================================================
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
  recurring_rule_id uuid, -- FK added after `rules` is created (see below)
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

-- ============================================================
-- 0002_rls_policies.sql
-- ============================================================
-- =============================================================================
-- AQA Finance — Row Level Security
--
-- Each user can only see and mutate their own rows. System default categories
-- (user_id is null) are readable by everyone but writable by no one via the
-- API. Child tables (pages, extractions, splits, debt_payments) are guarded by
-- ownership of their parent row.
-- =============================================================================

alter table profiles               enable row level security;
alter table accounts               enable row level security;
alter table work_streams           enable row level security;
alter table transaction_categories enable row level security;
alter table transactions           enable row level security;
alter table transaction_splits     enable row level security;
alter table documents              enable row level security;
alter table document_pages         enable row level security;
alter table extractions            enable row level security;
alter table bills                  enable row level security;
alter table subscriptions          enable row level security;
alter table debts                  enable row level security;
alter table debt_payments          enable row level security;
alter table savings_goals          enable row level security;
alter table budgets                enable row level security;
alter table bank_transactions      enable row level security;
alter table rules                  enable row level security;
alter table review_tasks           enable row level security;
alter table audit_log              enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Generic owner-scoped tables (helper macro repeated explicitly per table)
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  owner_tables text[] := array[
    'accounts', 'work_streams', 'transactions', 'documents', 'bills',
    'subscriptions', 'debts', 'savings_goals', 'budgets', 'bank_transactions',
    'rules', 'review_tasks', 'audit_log'
  ];
begin
  foreach t in array owner_tables loop
    execute format(
      'create policy %I on %I for select using (auth.uid() = user_id);',
      t || '_select_own', t);
    execute format(
      'create policy %I on %I for insert with check (auth.uid() = user_id);',
      t || '_insert_own', t);
    execute format(
      'create policy %I on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t || '_update_own', t);
    execute format(
      'create policy %I on %I for delete using (auth.uid() = user_id);',
      t || '_delete_own', t);
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- transaction_categories: read own + system defaults, write only own
-- ----------------------------------------------------------------------------
create policy "categories_select" on transaction_categories
  for select using (user_id is null or auth.uid() = user_id);
create policy "categories_insert_own" on transaction_categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on transaction_categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_delete_own" on transaction_categories
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Child tables guarded via parent ownership
-- ----------------------------------------------------------------------------
create policy "splits_all_own" on transaction_splits
  for all using (
    exists (select 1 from transactions x
            where x.id = transaction_splits.transaction_id and x.user_id = auth.uid())
  ) with check (
    exists (select 1 from transactions x
            where x.id = transaction_splits.transaction_id and x.user_id = auth.uid())
  );

create policy "document_pages_all_own" on document_pages
  for all using (
    exists (select 1 from documents d
            where d.id = document_pages.document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from documents d
            where d.id = document_pages.document_id and d.user_id = auth.uid())
  );

create policy "extractions_all_own" on extractions
  for all using (
    exists (select 1 from documents d
            where d.id = extractions.document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from documents d
            where d.id = extractions.document_id and d.user_id = auth.uid())
  );

create policy "debt_payments_all_own" on debt_payments
  for all using (
    exists (select 1 from debts d
            where d.id = debt_payments.debt_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from debts d
            where d.id = debt_payments.debt_id and d.user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Storage bucket for evidence documents (private)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "documents_storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "documents_storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 0003_seed_defaults.sql
-- ============================================================
-- =============================================================================
-- AQA Finance — default/seed data
--
--   * System categories are inserted with user_id = null (shared, read-only).
--   * `seed_user_defaults(uuid)` provisions a new user's default work streams
--     and starter accounts. Call it after signup (or from the app).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- System default categories (shared across all users)
-- ----------------------------------------------------------------------------
insert into transaction_categories (user_id, kind, name, code, sort_order) values
  -- Income
  (null, 'income',  'PHV / Ride-hailing income',  'inc_phv',           10),
  (null, 'income',  'Trade plate delivery income', 'inc_trade_plate',  20),
  (null, 'income',  'Design income',               'inc_design',       30),
  (null, 'income',  'Freelance income',            'inc_freelance',    40),
  (null, 'income',  'Other self-employed income',  'inc_other_se',     50),
  (null, 'income',  'Salary / PAYE',               'inc_salary',       60),
  (null, 'income',  'Refunds & rebates',           'inc_refund',       70),
  (null, 'income',  'Interest received',           'inc_interest',     80),
  -- Business expenses (allowable for sole trader)
  (null, 'expense', 'Fuel',                        'exp_fuel',        100),
  (null, 'expense', 'Vehicle insurance',           'exp_vehicle_ins', 110),
  (null, 'expense', 'Vehicle maintenance & repairs','exp_vehicle_maint',120),
  (null, 'expense', 'Vehicle lease / finance',     'exp_vehicle_lease',130),
  (null, 'expense', 'Parking & tolls',             'exp_parking',     140),
  (null, 'expense', 'Cleaning (vehicle)',          'exp_cleaning',    150),
  (null, 'expense', 'Operator / platform fees',    'exp_platform_fee',160),
  (null, 'expense', 'Licensing & badges',          'exp_licensing',   170),
  (null, 'expense', 'Mobile & data',               'exp_mobile',      180),
  (null, 'expense', 'Software & subscriptions',    'exp_software',    190),
  (null, 'expense', 'Equipment & hardware',        'exp_equipment',   200),
  (null, 'expense', 'Office & stationery',         'exp_office',      210),
  (null, 'expense', 'Accountancy & professional',  'exp_accountancy', 220),
  (null, 'expense', 'Bank & finance charges',      'exp_bank_charges',230),
  (null, 'expense', 'Advertising & marketing',     'exp_marketing',   240),
  (null, 'expense', 'Training & courses',          'exp_training',    250),
  (null, 'expense', 'Use of home as office',       'exp_home_office', 260),
  (null, 'expense', 'Travel & subsistence',        'exp_travel',      270),
  (null, 'expense', 'Materials & stock',           'exp_materials',   280),
  -- Personal living costs
  (null, 'expense', 'Rent / mortgage',             'exp_housing',     300),
  (null, 'expense', 'Council tax',                 'exp_council_tax', 310),
  (null, 'expense', 'Utilities',                   'exp_utilities',   320),
  (null, 'expense', 'Groceries',                   'exp_groceries',   330),
  (null, 'expense', 'Eating out & takeaway',       'exp_dining',      340),
  (null, 'expense', 'Personal transport',          'exp_personal_transport',350),
  (null, 'expense', 'Health & medical',            'exp_health',      360),
  (null, 'expense', 'Insurance (personal)',        'exp_personal_ins',370),
  (null, 'expense', 'Entertainment & leisure',     'exp_entertainment',380),
  (null, 'expense', 'Shopping & general',          'exp_shopping',    390),
  (null, 'expense', 'Childcare & family',          'exp_family',      400),
  (null, 'expense', 'Other personal',              'exp_other_personal',410),
  -- Transfers / debt / savings
  (null, 'transfer','Account transfer',            'tr_transfer',     500),
  (null, 'debt',    'Credit card payment',         'debt_cc',         510),
  (null, 'debt',    'Loan repayment',              'debt_loan',       520),
  (null, 'debt',    'BNPL repayment',              'debt_bnpl',       530),
  (null, 'savings', 'Savings contribution',        'sav_general',     540),
  (null, 'savings', 'Tax pot contribution',        'sav_tax_pot',     550)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Per-user bootstrap
-- ----------------------------------------------------------------------------
create or replace function seed_user_defaults(p_user_id uuid)
returns void as $$
begin
  -- Work streams
  insert into work_streams (user_id, code, name, active) values
    (p_user_id, 'phv',         'PHV / Private Hire',   true),
    (p_user_id, 'trade_plate', 'Trade Plate Driving',  true),
    (p_user_id, 'design',      'Design Work',          true),
    (p_user_id, 'freelance',   'Freelance',            true),
    (p_user_id, 'other',       'Other Income',         true)
  on conflict (user_id, code) do nothing;

  -- Starter accounts
  insert into accounts (user_id, name, account_type, provider, opening_balance, current_balance, active) values
    (p_user_id, 'Everyday Current Account', 'current',     'Monzo',      0, 0, true),
    (p_user_id, 'Business Current Account',  'current',     'Tide',       0, 0, true),
    (p_user_id, 'Savings',                   'savings',     'Chase',      0, 0, true),
    (p_user_id, 'Tax Pot',                   'tax_pot',     'Starling',   0, 0, true),
    (p_user_id, 'Cash',                      'cash',        null,         0, 0, true)
  on conflict do nothing;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 0004_work_stream_config.sql
-- ============================================================
-- =============================================================================
-- AQA Finance — work-stream configuration
--
-- Some work streams are "wage only": the user is paid a wage and all costs are
-- covered by the operator/employer (e.g. trade plate driving on a company card),
-- so no expenses should be recorded on the user's side. `tracks_expenses`
-- captures this so reporting and data entry can adapt.
-- =============================================================================

alter table work_streams
  add column if not exists tracks_expenses boolean not null default true;

alter table work_streams
  add column if not exists notes text;

-- Trade plate is wage-only with operator-covered expenses.
update work_streams
  set tracks_expenses = false,
      notes = 'Paid a wage; all running costs are on the operator''s company card, so no expenses are tracked here.'
  where code = 'trade_plate';

-- Keep the per-user bootstrap in sync.
create or replace function seed_user_defaults(p_user_id uuid)
returns void as $$
begin
  insert into work_streams (user_id, code, name, active, tracks_expenses, notes) values
    (p_user_id, 'phv',         'PHV / Private Hire',   true, true,  'Self-employed via operator. Upload weekly operator statements as evidence.'),
    (p_user_id, 'trade_plate', 'Trade Plate Driving',  true, false, 'Paid a wage; all running costs are on the operator''s company card.'),
    (p_user_id, 'design',      'Design Work',          true, true,  null),
    (p_user_id, 'freelance',   'Freelance',            true, true,  null),
    (p_user_id, 'other',       'Other Income',         true, true,  null)
  on conflict (user_id, code) do nothing;

  insert into accounts (user_id, name, account_type, provider, opening_balance, current_balance, active) values
    (p_user_id, 'Everyday Current Account', 'current',     'Monzo',      0, 0, true),
    (p_user_id, 'Business Current Account',  'current',     'Tide',       0, 0, true),
    (p_user_id, 'Savings',                   'savings',     'Chase',      0, 0, true),
    (p_user_id, 'Tax Pot',                   'tax_pot',     'Starling',   0, 0, true),
    (p_user_id, 'Cash',                      'cash',        null,         0, 0, true)
  on conflict do nothing;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 0005_debt_types_interest_free.sql
-- ============================================================
-- ----------------------------------------------------------------------------
-- 0005_debt_types_interest_free
--
-- Broaden the kinds of debt the app can track and model promotional /
-- interest-free periods (balance-transfer cards, store cards, BNPL plans).
--
-- New debt_type values:
--   store_card    — store / catalogue cards (often 0% intro then high APR)
--   overdraft     — arranged/unarranged current-account overdrafts
--   student_loan  — UK income-contingent student loans (Plan 1/2/4/5, PGL)
--   mortgage      — secured property loans
--   personal      — money owed to friends, family or informal lenders
--
-- New columns on debts:
--   interest_free_until — date a 0%/promo window ends (null = no promo)
--   promo_apr           — APR during that window (usually 0); `apr` is the
--                         revert rate that applies once the window ends.
--   period              — UK tax-year / accounting period a debt belongs to
--                         (e.g. '2025/26'); null = ongoing / revolving.
-- ----------------------------------------------------------------------------

-- New enum values. ADD VALUE is idempotent with IF NOT EXISTS (PG12+).
alter type debt_type add value if not exists 'store_card';
alter type debt_type add value if not exists 'overdraft';
alter type debt_type add value if not exists 'student_loan';
alter type debt_type add value if not exists 'mortgage';
alter type debt_type add value if not exists 'personal';

alter table debts
  add column if not exists interest_free_until date,
  add column if not exists promo_apr numeric(6, 3),
  add column if not exists period text;

comment on column debts.interest_free_until is
  'End date of a 0%/promotional interest window; null when none. While in the '
  'future, promo_apr applies; after it passes, apr (the revert rate) applies.';
comment on column debts.promo_apr is
  'APR charged during the interest-free window (usually 0).';
comment on column debts.period is
  'UK tax-year / accounting period the debt belongs to (e.g. 2025/26); '
  'null for ongoing / revolving debts.';

-- ============================================================
-- 0006_account_credit_terms.sql
-- ============================================================
-- ----------------------------------------------------------------------------
-- 0006_account_credit_terms
--
-- Credit-card terms on accounts: credit limit, standard/revert APR, and a 0% /
-- promotional interest offer (with its expiry date). These are only meaningful
-- for accounts where account_type = 'credit_card'; null for everything else.
--
--   credit_limit        — total credit limit on the card
--   apr                 — standard/revert purchase APR after any promo ends
--   interest_free_until — expiry date of a 0%/promo interest offer (null = none)
--   promo_apr           — APR during that offer window (usually 0)
-- ----------------------------------------------------------------------------

alter table accounts
  add column if not exists credit_limit numeric(14, 2),
  add column if not exists apr numeric(6, 3),
  add column if not exists interest_free_until date,
  add column if not exists promo_apr numeric(6, 3);

comment on column accounts.interest_free_until is
  'Expiry date of a 0%/promotional interest offer on a credit card; null when '
  'none. While in the future promo_apr applies, then apr (the revert rate).';

-- ============================================================
-- 0007_operating_costs.sql
-- ============================================================
-- ----------------------------------------------------------------------------
-- 0007_operating_costs
--
-- Running costs of operating the AQA Finance product itself — the infra / SaaS
-- the app depends on (Claude API, Vercel, Supabase, domain, …), kept separate
-- from the user's personal bills and subscriptions.
-- ----------------------------------------------------------------------------

create type operating_cost_category as enum
  ('ai', 'hosting', 'database', 'domain', 'email', 'tooling', 'other');

create table operating_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  vendor text,
  category operating_cost_category not null default 'other',
  amount_estimate numeric(14, 2) not null default 0,
  billing_cycle billing_cycle not null default 'monthly',
  usage_based boolean not null default false,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create index operating_costs_user_id_idx on operating_costs (user_id);

alter table operating_costs enable row level security;

create policy operating_costs_select_own on operating_costs
  for select using (auth.uid() = user_id);
create policy operating_costs_insert_own on operating_costs
  for insert with check (auth.uid() = user_id);
create policy operating_costs_update_own on operating_costs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy operating_costs_delete_own on operating_costs
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 0008_auth_allowlist.sql
-- ============================================================
-- ----------------------------------------------------------------------------
-- 0008_auth_allowlist
--
-- Restrict sign-in to a fixed set of allowed emails. Enforced at the database
-- level (a BEFORE INSERT trigger on auth.users), so it holds even if the client
-- allowlist is bypassed. Update the list here to change who can sign in.
-- ----------------------------------------------------------------------------

create or replace function public.enforce_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) not in (
    'aqakhtargroup@gmail.com',
    'aqakhtar96@gmail.com'
  ) then
    raise exception 'Email % is not permitted to sign in to this app', new.email
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_allowlist_trigger on auth.users;
create trigger enforce_email_allowlist_trigger
  before insert on auth.users
  for each row
  execute function public.enforce_email_allowlist();

-- ============================================================
-- 0009_ltd_operations.sql
-- ============================================================


-- =============================================================================
-- 0009_ltd_operations
--
-- Limited-company operating layer: company profile, clients, quotes, invoices
-- and a work log covering freelance hours, trade-plate shifts, PHV driving and
-- mileage. Line items live as jsonb on quotes/invoices so the existing generic
-- repository can CRUD them without nested child tables.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type entity_type as enum ('sole_trader', 'limited_company');

create type vat_scheme as enum
  ('none', 'standard', 'flat_rate', 'cash_accounting');

create type quote_status as enum
  ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted');

create type invoice_status as enum
  ('draft', 'sent', 'paid', 'part_paid', 'void');

create type work_entry_type as enum
  ('shift', 'hours', 'job', 'mileage', 'piece');

-- ----------------------------------------------------------------------------
-- company_profiles  (one row per user)
-- ----------------------------------------------------------------------------
create table company_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  entity_type entity_type not null default 'limited_company',
  legal_name text not null default '',
  trading_name text,
  company_number text,
  vat_registered boolean not null default false,
  vat_number text,
  vat_scheme vat_scheme not null default 'none',
  default_vat_rate numeric(5, 2) not null default 0,
  registered_address text,
  email text,
  phone text,
  website text,
  bank_name text,
  bank_sort_code text,
  bank_account_name text,
  bank_account_number text,
  invoice_prefix text not null default 'INV',
  next_invoice_number integer not null default 1,
  quote_prefix text not null default 'QTE',
  next_quote_number integer not null default 1,
  default_payment_terms_days integer not null default 14,
  default_quote_valid_days integer not null default 30,
  invoice_footer text,
  accounting_year_end_month integer not null default 3
    check (accounting_year_end_month between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index company_profiles_user_id_idx on company_profiles (user_id);

-- ----------------------------------------------------------------------------
-- clients
-- ----------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  vat_number text,
  default_work_stream_id uuid references work_streams (id) on delete set null,
  payment_terms_days integer,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index clients_user_id_idx on clients (user_id);
create index clients_user_active_idx on clients (user_id, active);

-- ----------------------------------------------------------------------------
-- quotes
-- ----------------------------------------------------------------------------
create table quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references clients (id) on delete set null,
  work_stream_id uuid references work_streams (id) on delete set null,
  number text not null,
  status quote_status not null default 'draft',
  issue_date date not null default current_date,
  valid_until date,
  line_items jsonb not null default '[]'::jsonb,
  notes text,
  terms text,
  net_amount numeric(14, 2) not null default 0,
  vat_amount numeric(14, 2) not null default 0,
  gross_amount numeric(14, 2) not null default 0,
  converted_invoice_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number)
);
create index quotes_user_id_idx on quotes (user_id);
create index quotes_status_idx on quotes (user_id, status);
create index quotes_client_idx on quotes (client_id);

-- ----------------------------------------------------------------------------
-- invoices
-- ----------------------------------------------------------------------------
create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references clients (id) on delete set null,
  work_stream_id uuid references work_streams (id) on delete set null,
  quote_id uuid references quotes (id) on delete set null,
  number text not null,
  status invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  paid_date date,
  paid_amount numeric(14, 2) not null default 0,
  line_items jsonb not null default '[]'::jsonb,
  notes text,
  terms text,
  net_amount numeric(14, 2) not null default 0,
  vat_amount numeric(14, 2) not null default 0,
  gross_amount numeric(14, 2) not null default 0,
  linked_transaction_id uuid references transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number)
);
create index invoices_user_id_idx on invoices (user_id);
create index invoices_status_idx on invoices (user_id, status);
create index invoices_client_idx on invoices (client_id);
create index invoices_due_date_idx on invoices (user_id, due_date);

-- ----------------------------------------------------------------------------
-- work_entries  (shifts, hours, mileage, piece work)
-- ----------------------------------------------------------------------------
create table work_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  work_stream_id uuid references work_streams (id) on delete set null,
  client_id uuid references clients (id) on delete set null,
  quote_id uuid references quotes (id) on delete set null,
  invoice_id uuid references invoices (id) on delete set null,
  entry_type work_entry_type not null default 'hours',
  occurred_on date not null default current_date,
  start_time time,
  end_time time,
  hours numeric(8, 2),
  miles numeric(10, 1),
  rate numeric(14, 2),
  amount numeric(14, 2),
  billable boolean not null default false,
  invoiced boolean not null default false,
  operator text,
  vehicle text,
  description text not null default '',
  notes text,
  created_at timestamptz not null default now()
);
create index work_entries_user_id_idx on work_entries (user_id);
create index work_entries_occurred_idx on work_entries (user_id, occurred_on desc);
create index work_entries_stream_idx on work_entries (work_stream_id);
create index work_entries_unbilled_idx on work_entries (user_id, billable, invoiced);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table company_profiles enable row level security;
alter table clients          enable row level security;
alter table quotes           enable row level security;
alter table invoices         enable row level security;
alter table work_entries     enable row level security;

do $$
declare
  t text;
  owner_tables text[] := array[
    'company_profiles', 'clients', 'quotes', 'invoices', 'work_entries'
  ];
begin
  foreach t in array owner_tables loop
    execute format(
      'create policy %I on %I for select using (auth.uid() = user_id);',
      t || '_select_own', t);
    execute format(
      'create policy %I on %I for insert with check (auth.uid() = user_id);',
      t || '_insert_own', t);
    execute format(
      'create policy %I on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t || '_update_own', t);
    execute format(
      'create policy %I on %I for delete using (auth.uid() = user_id);',
      t || '_delete_own', t);
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- LTD / invoicing categories (system defaults, user_id null)
-- ----------------------------------------------------------------------------
insert into transaction_categories (user_id, kind, name, code, sort_order) values
  (null, 'income',   'Invoice payments',            'inc_invoice',   45),
  (null, 'income',   'Director salary',             'inc_director',  61),
  (null, 'expense',  'Corporation tax',             'exp_corp_tax',  225),
  (null, 'expense',  'VAT payment',                 'exp_vat',       226),
  (null, 'expense',  'Companies House / filings',   'exp_filings',   227),
  (null, 'expense',  'Employer NI / PAYE',          'exp_paye',      228),
  (null, 'transfer', 'Director dividend',           'tr_dividend',   505)
on conflict do nothing;
