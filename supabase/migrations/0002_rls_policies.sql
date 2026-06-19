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
