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
