import type {
  Account,
  BankTransaction,
  Bill,
  Budget,
  Debt,
  Document,
  ReviewTask,
  SavingsGoal,
  Subscription,
  Transaction,
  TransactionCategory,
  WorkStream,
} from '../types/database';
import { isSupabaseConfigured, supabase } from './supabase';

const userId = 'demo-user';
const now = new Date().toISOString();

export type WorkStreamSummary = {
  code: WorkStream['code'];
  name: string;
  income: number;
  expenses: number;
  net: number;
  monthly: number[];
};

export type FinanceData = {
  accounts: Account[];
  workStreams: WorkStream[];
  categories: TransactionCategory[];
  transactions: Transaction[];
  documents: Document[];
  bills: Bill[];
  subscriptions: Subscription[];
  debts: Debt[];
  savingsGoals: SavingsGoal[];
  budgets: Budget[];
  bankTransactions: BankTransaction[];
  reviewTasks: ReviewTask[];
};

const categories: TransactionCategory[] = [
  { id: 'cat-income-phv', user_id: null, kind: 'income', name: 'PHV takings', code: 'income_phv', parent_id: null, sort_order: 10 },
  { id: 'cat-income-trade', user_id: null, kind: 'income', name: 'Trade plate income', code: 'income_trade_plate', parent_id: null, sort_order: 20 },
  { id: 'cat-income-design', user_id: null, kind: 'income', name: 'Design income', code: 'income_design', parent_id: null, sort_order: 30 },
  { id: 'cat-expense-fuel', user_id: null, kind: 'expense', name: 'Fuel', code: 'expense_fuel', parent_id: null, sort_order: 10 },
  { id: 'cat-expense-operator', user_id: null, kind: 'expense', name: 'Operator fees', code: 'expense_operator_fees', parent_id: null, sort_order: 20 },
  { id: 'cat-expense-software', user_id: null, kind: 'expense', name: 'Software and subscriptions', code: 'expense_software_subscriptions', parent_id: null, sort_order: 30 },
  { id: 'cat-expense-housing', user_id: null, kind: 'expense', name: 'Rent and mortgage', code: 'expense_housing', parent_id: null, sort_order: 40 },
  { id: 'cat-debt-card', user_id: null, kind: 'debt', name: 'Credit card payment', code: 'debt_credit_card_payment', parent_id: null, sort_order: 10 },
  { id: 'cat-savings-tax', user_id: null, kind: 'savings', name: 'Tax pot transfer', code: 'savings_tax_pot', parent_id: null, sort_order: 10 },
];

const workStreams: WorkStream[] = [
  { id: 'ws-phv', user_id: userId, code: 'phv', name: 'PHV', active: true, created_at: now },
  { id: 'ws-trade', user_id: userId, code: 'trade_plate', name: 'Trade plate', active: true, created_at: now },
  { id: 'ws-design', user_id: userId, code: 'design', name: 'Design', active: true, created_at: now },
  { id: 'ws-freelance', user_id: userId, code: 'freelance', name: 'Freelance', active: true, created_at: now },
  { id: 'ws-other', user_id: userId, code: 'other', name: 'Other', active: true, created_at: now },
];

const accounts: Account[] = [
  { id: 'acc-current', user_id: userId, name: 'Monzo Current', account_type: 'current', provider: 'Monzo', currency: 'GBP', opening_balance: 900, current_balance: 2450, last4: '1024', active: true, created_at: now },
  { id: 'acc-business', user_id: userId, name: 'Starling Business', account_type: 'current', provider: 'Starling', currency: 'GBP', opening_balance: 0, current_balance: 4210, last4: '8812', active: true, created_at: now },
  { id: 'acc-tax', user_id: userId, name: 'Tax Pot', account_type: 'tax_pot', provider: 'Chase', currency: 'GBP', opening_balance: 0, current_balance: 1320, last4: null, active: true, created_at: now },
  { id: 'acc-savings', user_id: userId, name: 'Emergency Fund', account_type: 'savings', provider: 'Marcus', currency: 'GBP', opening_balance: 1500, current_balance: 2275, last4: null, active: true, created_at: now },
  { id: 'acc-card', user_id: userId, name: 'Vanquis Credit Card', account_type: 'credit_card', provider: 'Vanquis', currency: 'GBP', opening_balance: -1900, current_balance: -1420, last4: '4421', active: true, created_at: now },
];

const documents: Document[] = [
  { id: 'doc-phv', user_id: userId, work_stream_id: 'ws-phv', file_name: 'bolt-weekly-statement-2026-06-14.pdf', mime_type: 'application/pdf', file_size: 480231, storage_path_original: 'documents/demo/bolt-weekly-statement.pdf', storage_path_preview: 'previews/demo/bolt-weekly-statement.png', source_type: 'upload', document_type: 'weekly_statement', checksum: 'demo-phv-statement', uploaded_at: now, processing_status: 'parsed', parsing_confidence: 0.92, review_status: 'approved', notes: 'Matched to PHV weekly payout.' },
  { id: 'doc-fuel', user_id: userId, work_stream_id: 'ws-phv', file_name: 'shell-fuel-receipt.jpg', mime_type: 'image/jpeg', file_size: 930211, storage_path_original: 'documents/demo/shell-fuel-receipt.jpg', storage_path_preview: 'previews/demo/shell-fuel-receipt.jpg', source_type: 'upload', document_type: 'receipt', checksum: 'demo-fuel-receipt', uploaded_at: now, processing_status: 'parsed', parsing_confidence: 0.64, review_status: 'needs_review', notes: 'VAT line unclear; review before approving.' },
  { id: 'doc-bank', user_id: userId, work_stream_id: null, file_name: 'monzo-june.csv', mime_type: 'text/csv', file_size: 81239, storage_path_original: 'documents/demo/monzo-june.csv', storage_path_preview: null, source_type: 'import', document_type: 'bank_statement', checksum: 'demo-bank-csv', uploaded_at: now, processing_status: 'matched', parsing_confidence: 0.98, review_status: 'approved', notes: 'CSV rows imported into bank_transactions.' },
  { id: 'doc-design', user_id: userId, work_stream_id: 'ws-design', file_name: 'aqa-brand-invoice.pdf', mime_type: 'application/pdf', file_size: 315092, storage_path_original: 'documents/demo/aqa-brand-invoice.pdf', storage_path_preview: 'previews/demo/aqa-brand-invoice.png', source_type: 'upload', document_type: 'invoice_sent', checksum: 'demo-design-invoice', uploaded_at: now, processing_status: 'matched', parsing_confidence: 0.88, review_status: 'approved', notes: 'Invoice linked to design income.' },
];

const transactions: Transaction[] = [
  { id: 'txn-phv', user_id: userId, account_id: 'acc-business', work_stream_id: 'ws-phv', category_id: 'cat-income-phv', transaction_date: '2026-06-14', posted_date: '2026-06-15', kind: 'income', ownership_type: 'business', counterparty: 'Bolt', description: 'PHV weekly operator payout', amount: 812.45, direction: 'inflow', currency: 'GBP', business_use_pct: 100, tax_relevant: true, recurring_rule_id: null, linked_document_id: 'doc-phv', linked_bill_id: null, linked_debt_id: null, transfer_group_id: null, reconciliation_status: 'reconciled', review_status: 'approved', notes: 'Net payout after platform fee.', created_at: now, updated_at: now },
  { id: 'txn-trade', user_id: userId, account_id: 'acc-business', work_stream_id: 'ws-trade', category_id: 'cat-income-trade', transaction_date: '2026-06-12', posted_date: '2026-06-12', kind: 'income', ownership_type: 'business', counterparty: 'Plate Logistics Ltd', description: 'Trade plate movements', amount: 430, direction: 'inflow', currency: 'GBP', business_use_pct: 100, tax_relevant: true, recurring_rule_id: null, linked_document_id: null, linked_bill_id: null, linked_debt_id: null, transfer_group_id: null, reconciliation_status: 'suggested_match', review_status: 'needs_review', notes: 'Missing operator statement evidence.', created_at: now, updated_at: now },
  { id: 'txn-design', user_id: userId, account_id: 'acc-business', work_stream_id: 'ws-design', category_id: 'cat-income-design', transaction_date: '2026-06-10', posted_date: '2026-06-10', kind: 'income', ownership_type: 'business', counterparty: 'AQA Studio Client', description: 'Brand identity invoice paid', amount: 1250, direction: 'inflow', currency: 'GBP', business_use_pct: 100, tax_relevant: true, recurring_rule_id: null, linked_document_id: 'doc-design', linked_bill_id: null, linked_debt_id: null, transfer_group_id: null, reconciliation_status: 'reconciled', review_status: 'approved', notes: null, created_at: now, updated_at: now },
  { id: 'txn-fuel', user_id: userId, account_id: 'acc-current', work_stream_id: 'ws-phv', category_id: 'cat-expense-fuel', transaction_date: '2026-06-13', posted_date: '2026-06-13', kind: 'expense', ownership_type: 'mixed', counterparty: 'Shell', description: 'Fuel', amount: 72.36, direction: 'outflow', currency: 'GBP', business_use_pct: 75, tax_relevant: true, recurring_rule_id: null, linked_document_id: 'doc-fuel', linked_bill_id: null, linked_debt_id: null, transfer_group_id: null, reconciliation_status: 'suggested_match', review_status: 'needs_review', notes: 'Business use based on mileage log.', created_at: now, updated_at: now },
  { id: 'txn-rent', user_id: userId, account_id: 'acc-current', work_stream_id: null, category_id: 'cat-expense-housing', transaction_date: '2026-06-01', posted_date: '2026-06-01', kind: 'expense', ownership_type: 'personal', counterparty: 'Landlord', description: 'Rent', amount: 950, direction: 'outflow', currency: 'GBP', business_use_pct: 0, tax_relevant: false, recurring_rule_id: null, linked_document_id: null, linked_bill_id: 'bill-rent', linked_debt_id: null, transfer_group_id: null, reconciliation_status: 'reconciled', review_status: 'not_required', notes: null, created_at: now, updated_at: now },
  { id: 'txn-card', user_id: userId, account_id: 'acc-current', work_stream_id: null, category_id: 'cat-debt-card', transaction_date: '2026-06-05', posted_date: '2026-06-05', kind: 'debt_payment', ownership_type: 'personal', counterparty: 'Vanquis', description: 'Credit card minimum payment', amount: 120, direction: 'outflow', currency: 'GBP', business_use_pct: 0, tax_relevant: false, recurring_rule_id: null, linked_document_id: null, linked_bill_id: null, linked_debt_id: 'debt-card', transfer_group_id: null, reconciliation_status: 'reconciled', review_status: 'not_required', notes: null, created_at: now, updated_at: now },
  { id: 'txn-tax-pot', user_id: userId, account_id: 'acc-tax', work_stream_id: null, category_id: 'cat-savings-tax', transaction_date: '2026-06-15', posted_date: '2026-06-15', kind: 'savings', ownership_type: 'business', counterparty: 'Internal transfer', description: 'Tax pot transfer from income receipts', amount: 360, direction: 'inflow', currency: 'GBP', business_use_pct: 100, tax_relevant: false, recurring_rule_id: null, linked_document_id: null, linked_bill_id: null, linked_debt_id: null, transfer_group_id: 'transfer-tax-001', reconciliation_status: 'reconciled', review_status: 'approved', notes: 'Suggested 20% of business income.', created_at: now, updated_at: now },
];

const bills: Bill[] = [
  { id: 'bill-rent', user_id: userId, name: 'Rent', category_id: 'cat-expense-housing', amount_estimate: 950, due_day: 1, frequency: 'monthly', account_id: 'acc-current', autopay: true, active: true, notes: null, created_at: now },
  { id: 'bill-insurance', user_id: userId, name: 'Vehicle insurance', category_id: 'cat-expense-operator', amount_estimate: 178, due_day: 18, frequency: 'monthly', account_id: 'acc-current', autopay: true, active: true, notes: 'PHV policy; attach renewal schedule.', created_at: now },
  { id: 'bill-phone', user_id: userId, name: 'Phone contract', category_id: 'cat-expense-software', amount_estimate: 39, due_day: 24, frequency: 'monthly', account_id: 'acc-current', autopay: true, active: true, notes: 'Mixed business use.', created_at: now },
];

const subscriptions: Subscription[] = [
  { id: 'sub-adobe', user_id: userId, name: 'Adobe Creative Cloud', amount_estimate: 56.98, billing_cycle: 'monthly', next_due_date: '2026-06-28', category_id: 'cat-expense-software', account_id: 'acc-business', active: true, created_at: now },
  { id: 'sub-accounting', user_id: userId, name: 'Accounting software', amount_estimate: 18, billing_cycle: 'monthly', next_due_date: '2026-07-02', category_id: 'cat-expense-software', account_id: 'acc-business', active: true, created_at: now },
];

const debts: Debt[] = [
  { id: 'debt-card', user_id: userId, name: 'Vanquis card', debt_type: 'credit_card', lender: 'Vanquis', account_id: 'acc-card', original_balance: 1900, current_balance: 1420, apr: 34.9, minimum_payment: 95, due_day: 5, status: 'active', created_at: now },
  { id: 'debt-car', user_id: userId, name: 'Vehicle finance', debt_type: 'car_finance', lender: 'Moto Finance', account_id: null, original_balance: 7800, current_balance: 6120, apr: 9.9, minimum_payment: 215, due_day: 21, status: 'active', created_at: now },
];

const savingsGoals: SavingsGoal[] = [
  { id: 'goal-emergency', user_id: userId, name: 'Emergency fund', target_amount: 5000, current_amount: 2275, linked_account_id: 'acc-savings', goal_type: 'emergency_fund', target_date: '2026-12-31', created_at: now },
  { id: 'goal-tax', user_id: userId, name: '2025/26 tax reserve', target_amount: 6000, current_amount: 1320, linked_account_id: 'acc-tax', goal_type: 'tax_pot', target_date: '2027-01-31', created_at: now },
];

const budgets: Budget[] = [
  { id: 'budget-fuel', user_id: userId, month_key: '2026-06', category_id: 'cat-expense-fuel', work_stream_id: 'ws-phv', ownership_type: 'mixed', target_amount: 360, created_at: now },
  { id: 'budget-software', user_id: userId, month_key: '2026-06', category_id: 'cat-expense-software', work_stream_id: 'ws-design', ownership_type: 'business', target_amount: 120, created_at: now },
  { id: 'budget-personal', user_id: userId, month_key: '2026-06', category_id: 'cat-expense-housing', work_stream_id: null, ownership_type: 'personal', target_amount: 1100, created_at: now },
];

const bankTransactions: BankTransaction[] = [
  { id: 'bank-1', user_id: userId, account_id: 'acc-current', txn_date: '2026-06-13', description: 'Shell fuel', amount: 72.36, direction: 'outflow', balance: 2380, source_document_id: 'doc-bank', matched_transaction_id: 'txn-fuel', reconciliation_status: 'suggested_match', created_at: now },
  { id: 'bank-2', user_id: userId, account_id: 'acc-business', txn_date: '2026-06-15', description: 'Bolt payout', amount: 812.45, direction: 'inflow', balance: 4210, source_document_id: 'doc-bank', matched_transaction_id: 'txn-phv', reconciliation_status: 'reconciled', created_at: now },
];

const reviewTasks: ReviewTask[] = [
  { id: 'review-fuel', user_id: userId, document_id: 'doc-fuel', transaction_id: 'txn-fuel', task_type: 'low_confidence_receipt', priority: 2, status: 'open', payload_json: { field: 'vat_amount', reason: 'OCR line blur' }, created_at: now, completed_at: null },
  { id: 'review-trade', user_id: userId, document_id: null, transaction_id: 'txn-trade', task_type: 'missing_evidence', priority: 1, status: 'open', payload_json: { expected_document_type: 'operator_statement' }, created_at: now, completed_at: null },
];

export const demoFinanceData: FinanceData = {
  accounts,
  workStreams,
  categories,
  transactions,
  documents,
  bills,
  subscriptions,
  debts,
  savingsGoals,
  budgets,
  bankTransactions,
  reviewTasks,
};

export async function loadFinanceData(): Promise<FinanceData> {
  if (!isSupabaseConfigured || !supabase) {
    return demoFinanceData;
  }

  const [
    accountsResult,
    streamsResult,
    categoriesResult,
    transactionsResult,
    documentsResult,
    billsResult,
    subscriptionsResult,
    debtsResult,
    savingsGoalsResult,
    budgetsResult,
    bankTransactionsResult,
    reviewTasksResult,
  ] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at'),
    supabase.from('work_streams').select('*').order('created_at'),
    supabase.from('transaction_categories').select('*').order('sort_order'),
    supabase.from('transactions').select('*').order('transaction_date', { ascending: false }),
    supabase.from('documents').select('*').order('uploaded_at', { ascending: false }),
    supabase.from('bills').select('*').order('due_day'),
    supabase.from('subscriptions').select('*').order('next_due_date'),
    supabase.from('debts').select('*').order('created_at'),
    supabase.from('savings_goals').select('*').order('created_at'),
    supabase.from('budgets').select('*').order('month_key'),
    supabase.from('bank_transactions').select('*').order('txn_date', { ascending: false }),
    supabase.from('review_tasks').select('*').order('priority'),
  ]);

  const errors = [
    accountsResult.error,
    streamsResult.error,
    categoriesResult.error,
    transactionsResult.error,
    documentsResult.error,
    billsResult.error,
    subscriptionsResult.error,
    debtsResult.error,
    savingsGoalsResult.error,
    budgetsResult.error,
    bankTransactionsResult.error,
    reviewTasksResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors.map((error) => error?.message).join('; '));
  }

  return {
    accounts: accountsResult.data ?? [],
    workStreams: streamsResult.data ?? [],
    categories: categoriesResult.data ?? [],
    transactions: transactionsResult.data ?? [],
    documents: documentsResult.data ?? [],
    bills: billsResult.data ?? [],
    subscriptions: subscriptionsResult.data ?? [],
    debts: debtsResult.data ?? [],
    savingsGoals: savingsGoalsResult.data ?? [],
    budgets: budgetsResult.data ?? [],
    bankTransactions: bankTransactionsResult.data ?? [],
    reviewTasks: reviewTasksResult.data ?? [],
  };
}

export function getCategoryName(data: FinanceData, categoryId: string | null) {
  return data.categories.find((category) => category.id === categoryId)?.name ?? 'Uncategorised';
}

export function getAccountName(data: FinanceData, accountId: string | null) {
  return data.accounts.find((account) => account.id === accountId)?.name ?? 'No account';
}

export function getWorkStreamName(data: FinanceData, workStreamId: string | null) {
  return data.workStreams.find((stream) => stream.id === workStreamId)?.name ?? 'Unassigned';
}

export function getDashboardMetrics(data: FinanceData) {
  const cash = data.accounts
    .filter((account) => account.active && !['credit_card', 'loan'].includes(account.account_type))
    .reduce((sum, account) => sum + (account.current_balance ?? 0), 0);
  const moneyIn = data.transactions
    .filter((transaction) => transaction.direction === 'inflow')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const moneyOut = data.transactions
    .filter((transaction) => transaction.direction === 'outflow')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const debtTotal = data.debts
    .filter((debt) => debt.status === 'active')
    .reduce((sum, debt) => sum + debt.current_balance, 0);
  const taxPot = data.accounts
    .filter((account) => account.account_type === 'tax_pot')
    .reduce((sum, account) => sum + (account.current_balance ?? 0), 0);
  const taxRelevantExpenses = data.transactions
    .filter((transaction) => transaction.tax_relevant && transaction.direction === 'outflow')
    .reduce((sum, transaction) => sum + transaction.amount * (transaction.business_use_pct / 100), 0);
  const missingEvidence = data.transactions.filter(
    (transaction) => transaction.tax_relevant && !transaction.linked_document_id,
  ).length;

  return { cash, moneyIn, moneyOut, debtTotal, taxPot, taxRelevantExpenses, missingEvidence };
}

export function getWorkStreamSummaries(data: FinanceData): WorkStreamSummary[] {
  return data.workStreams.map((stream, index) => {
    const streamTransactions = data.transactions.filter((transaction) => transaction.work_stream_id === stream.id);
    const income = streamTransactions
      .filter((transaction) => transaction.direction === 'inflow')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expenses = streamTransactions
      .filter((transaction) => transaction.direction === 'outflow')
      .reduce((sum, transaction) => sum + transaction.amount * (transaction.business_use_pct / 100), 0);

    return {
      code: stream.code,
      name: stream.name,
      income,
      expenses,
      net: income - expenses,
      monthly: [0.62, 0.74, 0.58, 0.82, 0.71, 0.9].map((weight) =>
        Math.round((income - expenses) * weight * (0.86 + index * 0.04)),
      ),
    };
  });
}
