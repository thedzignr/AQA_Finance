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
