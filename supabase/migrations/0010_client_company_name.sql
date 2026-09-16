-- =============================================================================
-- 0010_client_company_name
--
-- Clients can store a company name separately from the client/contact name so
-- quotes and invoices can bill a company.
-- Idempotent: safe to re-run in the SQL editor.
-- =============================================================================

alter table clients add column if not exists company_name text;

notify pgrst, 'reload schema';
