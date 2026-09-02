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
