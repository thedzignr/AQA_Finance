insert into transaction_categories (kind, name, code, sort_order) values
  ('income', 'PHV takings', 'income_phv', 10),
  ('income', 'Trade plate income', 'income_trade_plate', 20),
  ('income', 'Design income', 'income_design', 30),
  ('income', 'Freelance income', 'income_freelance', 40),
  ('income', 'Other income', 'income_other', 50),
  ('expense', 'Fuel', 'expense_fuel', 10),
  ('expense', 'Vehicle maintenance', 'expense_vehicle_maintenance', 20),
  ('expense', 'Insurance', 'expense_insurance', 30),
  ('expense', 'Operator fees', 'expense_operator_fees', 40),
  ('expense', 'Parking and tolls', 'expense_parking_tolls', 50),
  ('expense', 'Software and subscriptions', 'expense_software_subscriptions', 60),
  ('expense', 'Phone and internet', 'expense_phone_internet', 70),
  ('expense', 'Office and equipment', 'expense_office_equipment', 80),
  ('expense', 'Professional fees', 'expense_professional_fees', 90),
  ('expense', 'Rent and mortgage', 'expense_housing', 100),
  ('expense', 'Utilities', 'expense_utilities', 110),
  ('expense', 'Groceries', 'expense_groceries', 120),
  ('expense', 'Travel', 'expense_travel', 130),
  ('expense', 'Personal spending', 'expense_personal_spending', 140),
  ('expense', 'Tax-deductible expense', 'expense_tax_deductible', 150),
  ('transfer', 'Account transfer', 'transfer_account', 10),
  ('debt', 'Credit card payment', 'debt_credit_card_payment', 10),
  ('debt', 'Loan payment', 'debt_loan_payment', 20),
  ('savings', 'Emergency fund', 'savings_emergency_fund', 10),
  ('savings', 'Tax pot transfer', 'savings_tax_pot', 20)
on conflict do nothing;

create or replace function seed_user_finance_defaults(target_user_id uuid)
returns void as $$
begin
  insert into work_streams (user_id, code, name) values
    (target_user_id, 'phv', 'PHV'),
    (target_user_id, 'trade_plate', 'Trade plate'),
    (target_user_id, 'design', 'Design'),
    (target_user_id, 'freelance', 'Freelance'),
    (target_user_id, 'other', 'Other')
  on conflict (user_id, code) do nothing;

  insert into accounts (user_id, name, account_type, currency, opening_balance, current_balance) values
    (target_user_id, 'Main current account', 'current', 'GBP', 0, 0),
    (target_user_id, 'Business cash wallet', 'cash', 'GBP', 0, 0),
    (target_user_id, 'Tax pot', 'tax_pot', 'GBP', 0, 0),
    (target_user_id, 'Emergency savings', 'savings', 'GBP', 0, 0),
    (target_user_id, 'Credit card', 'credit_card', 'GBP', 0, 0)
  on conflict do nothing;

  insert into rules (user_id, rule_type, name, conditions_json, actions_json, active) values
    (
      target_user_id,
      'work_stream',
      'PHV operator statements',
      '{"document_type":["weekly_statement","operator_statement"],"keywords":["uber","bolt","freenow","operator"]}'::jsonb,
      '{"suggest_work_stream":"phv","tax_relevant":true}'::jsonb,
      true
    ),
    (
      target_user_id,
      'category',
      'Fuel merchants',
      '{"merchant_keywords":["shell","bp","esso","texaco","costco fuel"]}'::jsonb,
      '{"suggest_category_code":"expense_fuel","ownership_type":"mixed","tax_relevant":true}'::jsonb,
      true
    ),
    (
      target_user_id,
      'recurring',
      'Monthly fixed cost detector',
      '{"same_counterparty":true,"amount_variance_pct":5,"minimum_occurrences":3}'::jsonb,
      '{"create_review_task":true,"suggest_bill":true}'::jsonb,
      true
    )
  on conflict do nothing;
end;
$$ language plpgsql security definer;

create or replace function handle_new_user_profile()
returns trigger as $$
begin
  insert into profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, profiles.full_name),
        email = excluded.email;

  perform seed_user_finance_defaults(new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user_profile();
