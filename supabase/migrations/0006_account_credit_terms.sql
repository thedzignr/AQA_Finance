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
