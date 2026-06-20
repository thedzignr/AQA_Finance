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
