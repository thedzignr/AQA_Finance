create extension if not exists pgcrypto;

create type account_type as enum ('current', 'savings', 'credit_card', 'cash', 'loan', 'tax_pot', 'other');
create type category_kind as enum ('income', 'expense', 'transfer', 'debt', 'savings');
create type transaction_kind as enum ('income', 'expense', 'transfer', 'debt_payment', 'savings', 'adjustment');
create type ownership_type as enum ('personal', 'business', 'mixed');
create type money_direction as enum ('inflow', 'outflow');
create type source_type as enum ('upload', 'email', 'import');
create type document_type as enum ('receipt', 'invoice_sent', 'invoice_received', 'weekly_statement', 'operator_statement', 'bank_statement', 'payout_report', 'screenshot', 'mileage_log', 'unknown');
create type processing_status as enum ('queued', 'processing', 'parsed', 'matched', 'failed');
create type review_status as enum ('not_required', 'needs_review', 'approved', 'rejected');
create type reconciliation_status as enum ('unreconciled', 'suggested_match', 'reconciled', 'ignored');
create type bill_frequency as enum ('weekly', 'monthly', 'quarterly', 'yearly', 'custom');
create type billing_cycle as enum ('weekly', 'monthly', 'yearly');
create type debt_type as enum ('credit_card', 'loan', 'car_finance', 'tax', 'bnpl', 'other');
create type debt_status as enum ('active', 'paid_off', 'paused', 'defaulted');
create type savings_goal_type as enum ('emergency_fund', 'tax_pot', 'sinking_fund', 'vehicle', 'holiday', 'other');
create type rule_type as enum ('merchant', 'keyword', 'recurring', 'work_stream', 'category', 'bill_match', 'debt_match', 'transfer_match');
create type review_task_status as enum ('open', 'in_progress', 'completed', 'dismissed');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  created_at timestamptz not null default now()
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  account_type account_type not null,
  provider text,
  currency char(3) not null default 'GBP',
  opening_balance numeric(14,2),
  current_balance numeric(14,2),
  last4 text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint accounts_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint accounts_last4_check check (last4 is null or last4 ~ '^[0-9]{4}$')
);

create table work_streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint work_streams_code_check check (code in ('phv', 'trade_plate', 'design', 'freelance', 'other')),
  unique (user_id, code)
);

create table transaction_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  kind category_kind not null,
  name text not null,
  code text not null,
  parent_id uuid references transaction_categories(id) on delete set null,
  sort_order integer not null default 0,
  unique (user_id, code)
);

create table bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  category_id uuid references transaction_categories(id) on delete set null,
  amount_estimate numeric(14,2),
  due_day integer,
  frequency bill_frequency not null,
  account_id uuid references accounts(id) on delete set null,
  autopay boolean not null default false,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  constraint bills_due_day_check check (due_day is null or due_day between 1 and 31)
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  amount_estimate numeric(14,2) not null,
  billing_cycle billing_cycle not null,
  next_due_date date,
  category_id uuid references transaction_categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  debt_type debt_type not null,
  lender text,
  account_id uuid references accounts(id) on delete set null,
  original_balance numeric(14,2),
  current_balance numeric(14,2) not null,
  apr numeric(6,3),
  minimum_payment numeric(14,2),
  due_day integer,
  status debt_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint debts_due_day_check check (due_day is null or due_day between 1 and 31),
  constraint debts_apr_check check (apr is null or apr >= 0)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  work_stream_id uuid references work_streams(id) on delete set null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  storage_path_original text not null,
  storage_path_preview text,
  source_type source_type not null default 'upload',
  document_type document_type not null default 'unknown',
  checksum text not null,
  uploaded_at timestamptz not null default now(),
  processing_status processing_status not null default 'queued',
  parsing_confidence numeric(5,4),
  review_status review_status not null default 'needs_review',
  notes text,
  unique (user_id, checksum),
  constraint documents_confidence_check check (parsing_confidence is null or parsing_confidence between 0 and 1)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  work_stream_id uuid references work_streams(id) on delete set null,
  category_id uuid references transaction_categories(id) on delete set null,
  transaction_date date not null,
  posted_date date,
  kind transaction_kind not null,
  ownership_type ownership_type not null,
  counterparty text,
  description text not null,
  amount numeric(14,2) not null,
  direction money_direction not null,
  currency char(3) not null default 'GBP',
  business_use_pct numeric(5,2) not null default 100,
  tax_relevant boolean not null default false,
  recurring_rule_id uuid,
  linked_document_id uuid references documents(id) on delete set null,
  linked_bill_id uuid references bills(id) on delete set null,
  linked_debt_id uuid references debts(id) on delete set null,
  transfer_group_id uuid,
  reconciliation_status reconciliation_status not null default 'unreconciled',
  review_status review_status not null default 'not_required',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_amount_check check (amount >= 0),
  constraint transactions_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint transactions_business_use_pct_check check (business_use_pct between 0 and 100),
  constraint transactions_posted_after_transaction_check check (posted_date is null or posted_date >= transaction_date)
);

create table document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  page_number integer not null,
  extracted_text text,
  preview_path text,
  unique (document_id, page_number),
  constraint document_pages_page_check check (page_number > 0)
);

create table extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  extractor_version text not null,
  raw_text text,
  raw_json jsonb not null default '{}'::jsonb,
  normalized_json jsonb not null default '{}'::jsonb,
  confidence_score numeric(5,4) not null,
  created_at timestamptz not null default now(),
  constraint extractions_confidence_check check (confidence_score between 0 and 1)
);

create table debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references debts(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete set null,
  payment_date date not null,
  amount numeric(14,2) not null,
  principal_amount numeric(14,2),
  interest_amount numeric(14,2),
  fees_amount numeric(14,2),
  created_at timestamptz not null default now(),
  constraint debt_payments_amount_check check (amount >= 0)
);

create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2),
  current_amount numeric(14,2) not null default 0,
  linked_account_id uuid references accounts(id) on delete set null,
  goal_type savings_goal_type not null,
  target_date date,
  created_at timestamptz not null default now()
);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  month_key text not null,
  category_id uuid references transaction_categories(id) on delete set null,
  work_stream_id uuid references work_streams(id) on delete set null,
  ownership_type ownership_type,
  target_amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  constraint budgets_month_key_check check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  unique (user_id, month_key, category_id, work_stream_id, ownership_type)
);

create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  txn_date date not null,
  description text not null,
  amount numeric(14,2) not null,
  direction money_direction not null,
  balance numeric(14,2),
  source_document_id uuid references documents(id) on delete set null,
  matched_transaction_id uuid references transactions(id) on delete set null,
  reconciliation_status reconciliation_status not null default 'unreconciled',
  created_at timestamptz not null default now(),
  constraint bank_transactions_amount_check check (amount >= 0)
);

create table rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  rule_type rule_type not null,
  name text not null,
  conditions_json jsonb not null default '{}'::jsonb,
  actions_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table review_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete cascade,
  task_type text not null,
  priority integer not null default 3,
  status review_task_status not null default 'open',
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint review_tasks_priority_check check (priority between 1 and 5)
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

alter table transactions
  add constraint transactions_recurring_rule_fk
  foreign key (recurring_rule_id) references rules(id) on delete set null;

create table transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  category_id uuid references transaction_categories(id) on delete set null,
  work_stream_id uuid references work_streams(id) on delete set null,
  ownership_type ownership_type not null,
  amount numeric(14,2) not null,
  business_use_pct numeric(5,2) not null default 100,
  tax_relevant boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  constraint transaction_splits_amount_check check (amount >= 0),
  constraint transaction_splits_business_use_pct_check check (business_use_pct between 0 and 100)
);

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

create index accounts_user_type_idx on accounts (user_id, account_type) where active;
create index work_streams_user_code_idx on work_streams (user_id, code) where active;
create index transaction_categories_user_kind_idx on transaction_categories (user_id, kind, sort_order);
create unique index transaction_categories_default_code_idx on transaction_categories (kind, code) where user_id is null;
create index transactions_user_date_idx on transactions (user_id, transaction_date desc);
create index transactions_account_date_idx on transactions (account_id, transaction_date desc);
create index transactions_work_stream_date_idx on transactions (work_stream_id, transaction_date desc) where work_stream_id is not null;
create index transactions_category_idx on transactions (category_id) where category_id is not null;
create index transactions_tax_evidence_idx on transactions (user_id, tax_relevant, linked_document_id) where tax_relevant;
create index transactions_transfer_group_idx on transactions (transfer_group_id) where transfer_group_id is not null;
create index documents_user_uploaded_idx on documents (user_id, uploaded_at desc);
create index documents_review_idx on documents (user_id, review_status, processing_status);
create index extractions_document_created_idx on extractions (document_id, created_at desc);
create index bills_user_due_idx on bills (user_id, active, due_day);
create index subscriptions_user_next_due_idx on subscriptions (user_id, active, next_due_date);
create index debts_user_status_idx on debts (user_id, status);
create index budgets_user_month_idx on budgets (user_id, month_key);
create index bank_transactions_match_idx on bank_transactions (user_id, account_id, txn_date, reconciliation_status);
create index rules_user_type_idx on rules (user_id, rule_type) where active;
create index review_tasks_user_status_idx on review_tasks (user_id, status, priority, created_at);
create index audit_log_entity_idx on audit_log (entity_type, entity_id, created_at desc);

alter table profiles enable row level security;
alter table accounts enable row level security;
alter table work_streams enable row level security;
alter table transaction_categories enable row level security;
alter table transactions enable row level security;
alter table transaction_splits enable row level security;
alter table documents enable row level security;
alter table document_pages enable row level security;
alter table extractions enable row level security;
alter table bills enable row level security;
alter table subscriptions enable row level security;
alter table debts enable row level security;
alter table debt_payments enable row level security;
alter table savings_goals enable row level security;
alter table budgets enable row level security;
alter table bank_transactions enable row level security;
alter table rules enable row level security;
alter table review_tasks enable row level security;
alter table audit_log enable row level security;

create policy "Users can manage their profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can view default and own categories" on transaction_categories
  for select using (user_id is null or auth.uid() = user_id);
create policy "Users can insert own categories" on transaction_categories
  for insert with check (auth.uid() = user_id);
create policy "Users can update own categories" on transaction_categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own categories" on transaction_categories
  for delete using (auth.uid() = user_id);

create policy "Users own accounts" on accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own work streams" on work_streams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own transactions" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own documents" on documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own bills" on bills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own subscriptions" on subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own debts" on debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own savings goals" on savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own budgets" on budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own bank transactions" on bank_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own rules" on rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own review tasks" on review_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own audit records" on audit_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users access pages through owned documents" on document_pages
  for all using (
    exists (select 1 from documents d where d.id = document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from documents d where d.id = document_id and d.user_id = auth.uid())
  );

create policy "Users access extractions through owned documents" on extractions
  for all using (
    exists (select 1 from documents d where d.id = document_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from documents d where d.id = document_id and d.user_id = auth.uid())
  );

create policy "Users access splits through owned transactions" on transaction_splits
  for all using (
    exists (select 1 from transactions t where t.id = transaction_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from transactions t where t.id = transaction_id and t.user_id = auth.uid())
  );

create policy "Users access payments through owned debts" on debt_payments
  for all using (
    exists (select 1 from debts d where d.id = debt_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from debts d where d.id = debt_id and d.user_id = auth.uid())
  );
