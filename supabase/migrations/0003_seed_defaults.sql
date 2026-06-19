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
