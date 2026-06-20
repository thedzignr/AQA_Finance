import type {
  Account,
  Bill,
  Budget,
  Debt,
  DebtPayment,
  DocumentRecord,
  Extraction,
  Rule,
  ReviewTask,
  SavingsGoal,
  Subscription,
  Transaction,
  TransactionCategory,
  WorkStream,
  WorkStreamCode,
} from "@/types/domain";
import { monthKey } from "@/lib/utils";
import { type Dataset, emptyDataset } from "./dataset";

export const DEMO_USER_ID = "demo-user-0001";

// Relative date helpers so the demo always looks "current".
const NOW = new Date();
function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function iso(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function inDays(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ----------------------------------------------------------------------------
// Categories (mirror supabase/migrations/0003 system defaults)
// ----------------------------------------------------------------------------
const CATEGORY_DEFS: Array<Omit<TransactionCategory, "id" | "user_id">> = [
  { kind: "income", name: "PHV / Ride-hailing income", code: "inc_phv", parent_id: null, sort_order: 10 },
  { kind: "income", name: "Trade plate delivery income", code: "inc_trade_plate", parent_id: null, sort_order: 20 },
  { kind: "income", name: "Design income", code: "inc_design", parent_id: null, sort_order: 30 },
  { kind: "income", name: "Freelance income", code: "inc_freelance", parent_id: null, sort_order: 40 },
  { kind: "income", name: "Other self-employed income", code: "inc_other_se", parent_id: null, sort_order: 50 },
  { kind: "income", name: "Salary / PAYE", code: "inc_salary", parent_id: null, sort_order: 60 },
  { kind: "income", name: "Refunds & rebates", code: "inc_refund", parent_id: null, sort_order: 70 },
  { kind: "income", name: "Interest received", code: "inc_interest", parent_id: null, sort_order: 80 },
  { kind: "expense", name: "Fuel", code: "exp_fuel", parent_id: null, sort_order: 100 },
  { kind: "expense", name: "Vehicle insurance", code: "exp_vehicle_ins", parent_id: null, sort_order: 110 },
  { kind: "expense", name: "Vehicle maintenance & repairs", code: "exp_vehicle_maint", parent_id: null, sort_order: 120 },
  { kind: "expense", name: "Vehicle lease / finance", code: "exp_vehicle_lease", parent_id: null, sort_order: 130 },
  { kind: "expense", name: "Parking & tolls", code: "exp_parking", parent_id: null, sort_order: 140 },
  { kind: "expense", name: "Cleaning (vehicle)", code: "exp_cleaning", parent_id: null, sort_order: 150 },
  { kind: "expense", name: "Operator / platform fees", code: "exp_platform_fee", parent_id: null, sort_order: 160 },
  { kind: "expense", name: "Licensing & badges", code: "exp_licensing", parent_id: null, sort_order: 170 },
  { kind: "expense", name: "Mobile & data", code: "exp_mobile", parent_id: null, sort_order: 180 },
  { kind: "expense", name: "Software & subscriptions", code: "exp_software", parent_id: null, sort_order: 190 },
  { kind: "expense", name: "Equipment & hardware", code: "exp_equipment", parent_id: null, sort_order: 200 },
  { kind: "expense", name: "Office & stationery", code: "exp_office", parent_id: null, sort_order: 210 },
  { kind: "expense", name: "Accountancy & professional", code: "exp_accountancy", parent_id: null, sort_order: 220 },
  { kind: "expense", name: "Bank & finance charges", code: "exp_bank_charges", parent_id: null, sort_order: 230 },
  { kind: "expense", name: "Advertising & marketing", code: "exp_marketing", parent_id: null, sort_order: 240 },
  { kind: "expense", name: "Training & courses", code: "exp_training", parent_id: null, sort_order: 250 },
  { kind: "expense", name: "Use of home as office", code: "exp_home_office", parent_id: null, sort_order: 260 },
  { kind: "expense", name: "Travel & subsistence", code: "exp_travel", parent_id: null, sort_order: 270 },
  { kind: "expense", name: "Materials & stock", code: "exp_materials", parent_id: null, sort_order: 280 },
  { kind: "expense", name: "Rent / mortgage", code: "exp_housing", parent_id: null, sort_order: 300 },
  { kind: "expense", name: "Council tax", code: "exp_council_tax", parent_id: null, sort_order: 310 },
  { kind: "expense", name: "Utilities", code: "exp_utilities", parent_id: null, sort_order: 320 },
  { kind: "expense", name: "Groceries", code: "exp_groceries", parent_id: null, sort_order: 330 },
  { kind: "expense", name: "Eating out & takeaway", code: "exp_dining", parent_id: null, sort_order: 340 },
  { kind: "expense", name: "Personal transport", code: "exp_personal_transport", parent_id: null, sort_order: 350 },
  { kind: "expense", name: "Health & medical", code: "exp_health", parent_id: null, sort_order: 360 },
  { kind: "expense", name: "Insurance (personal)", code: "exp_personal_ins", parent_id: null, sort_order: 370 },
  { kind: "expense", name: "Entertainment & leisure", code: "exp_entertainment", parent_id: null, sort_order: 380 },
  { kind: "expense", name: "Shopping & general", code: "exp_shopping", parent_id: null, sort_order: 390 },
  { kind: "expense", name: "Childcare & family", code: "exp_family", parent_id: null, sort_order: 400 },
  { kind: "expense", name: "Other personal", code: "exp_other_personal", parent_id: null, sort_order: 410 },
  { kind: "transfer", name: "Account transfer", code: "tr_transfer", parent_id: null, sort_order: 500 },
  { kind: "debt", name: "Credit card payment", code: "debt_cc", parent_id: null, sort_order: 510 },
  { kind: "debt", name: "Loan repayment", code: "debt_loan", parent_id: null, sort_order: 520 },
  { kind: "debt", name: "BNPL repayment", code: "debt_bnpl", parent_id: null, sort_order: 530 },
  { kind: "savings", name: "Savings contribution", code: "sav_general", parent_id: null, sort_order: 540 },
  { kind: "savings", name: "Tax pot contribution", code: "sav_tax_pot", parent_id: null, sort_order: 550 },
];

export function buildSeedDataset(): Dataset {
  const ds = emptyDataset();
  const u = DEMO_USER_ID;

  ds.profile = {
    id: u,
    full_name: "Alex Rivera",
    email: "alex@aqafinance.app",
    created_at: iso(400),
  };

  // Categories ------------------------------------------------------------
  const cat: Record<string, TransactionCategory> = {};
  ds.categories = CATEGORY_DEFS.map((c, i) => {
    const row: TransactionCategory = {
      id: `cat_${c.code}`,
      user_id: null,
      ...c,
      sort_order: c.sort_order ?? i,
    };
    cat[c.code] = row;
    return row;
  });
  const cid = (code: string) => cat[code]?.id ?? null;

  // Work streams ----------------------------------------------------------
  const ws: Record<WorkStreamCode, WorkStream> = {} as Record<WorkStreamCode, WorkStream>;
  const wsDefs: Array<[WorkStreamCode, string, boolean, string | null]> = [
    ["phv", "PHV / Private Hire", true, "Self-employed via operator. Upload weekly operator statements as evidence."],
    ["trade_plate", "Trade Plate Driving", false, "Paid a wage; all running costs are on the operator's company card, so no expenses are tracked here."],
    ["design", "Design Work", true, null],
    ["freelance", "Freelance", true, null],
    ["other", "Other Income", true, null],
  ];
  ds.workStreams = wsDefs.map(([code, name, tracks_expenses, notes]) => {
    const row: WorkStream = {
      id: `ws_${code}`,
      user_id: u,
      code,
      name,
      active: true,
      tracks_expenses,
      notes,
      created_at: iso(400),
    };
    ws[code] = row;
    return row;
  });

  // Accounts --------------------------------------------------------------
  const acc = (
    id: string,
    name: string,
    type: Account["account_type"],
    provider: string | null,
    balance: number,
    last4: string | null = null,
  ): Account => ({
    id,
    user_id: u,
    name,
    account_type: type,
    provider,
    currency: "GBP",
    opening_balance: 0,
    current_balance: balance,
    last4,
    active: true,
    created_at: iso(400),
  });
  ds.accounts = [
    acc("acc_personal", "Everyday Current", "current", "Monzo", 1842.55, "4417"),
    acc("acc_business", "Business Current", "current", "Tide", 3960.12, "8802"),
    acc("acc_savings", "Savings", "savings", "Chase", 5200.0, "1190"),
    acc("acc_taxpot", "Tax Pot", "tax_pot", "Starling", 4120.0, "7741"),
    acc("acc_credit", "Credit Card", "credit_card", "Barclaycard", -2340.18, "5563"),
    acc("acc_cash", "Cash", "cash", null, 95.0),
  ];

  // -----------------------------------------------------------------------
  // Documents + extractions (evidence)
  // -----------------------------------------------------------------------
  const doc = (
    id: string,
    file_name: string,
    mime: string,
    type: DocumentRecord["document_type"],
    status: DocumentRecord["processing_status"],
    confidence: number,
    review: DocumentRecord["review_status"],
    daysAgoUploaded: number,
    work_stream_id: string | null = null,
  ): DocumentRecord => ({
    id,
    user_id: u,
    work_stream_id,
    file_name,
    mime_type: mime,
    file_size: 180_000 + Math.round(Math.random() * 800_000),
    storage_path_original: `${u}/originals/${file_name}`,
    storage_path_preview: `${u}/previews/${file_name}.png`,
    source_type: "upload",
    document_type: type,
    checksum: `chk_${id}`,
    uploaded_at: iso(daysAgoUploaded),
    processing_status: status,
    parsing_confidence: confidence,
    review_status: review,
    notes: null,
  });

  ds.documents = [
    doc("doc_fuel", "shell-fuel-receipt.jpg", "image/jpeg", "receipt", "completed", 0.94, "approved", 5, ws.phv.id),
    doc("doc_phv_week", "uber-weekly-statement.pdf", "application/pdf", "weekly_statement", "completed", 0.97, "approved", 7, ws.phv.id),
    doc("doc_bankcsv", "monzo-statement-jan.csv", "text/csv", "bank_statement", "completed", 0.99, "approved", 3),
    doc("doc_parking", "ncp-parking.png", "image/png", "receipt", "needs_review", 0.58, "needs_review", 2, ws.phv.id),
    doc("doc_invoice", "design-invoice-0042.pdf", "application/pdf", "invoice_sent", "completed", 0.91, "approved", 12, ws.design.id),
    doc("doc_dup", "shell-fuel-receipt-copy.jpg", "image/jpeg", "receipt", "needs_review", 0.93, "needs_review", 1, ws.phv.id),
  ];

  ds.extractions = [
    extraction("ex_fuel", "doc_fuel", "ocr-mock@1.2.0", 0.94, {
      document_type: "receipt",
      supplier: "Shell",
      date: daysAgo(5),
      total: 62.4,
      net: 52.0,
      vat_amount: 10.4,
      vat_rate: 20,
      currency: "GBP",
      work_stream_hint: "phv",
      suggested_category_code: "exp_fuel",
      direction_hint: "outflow",
    }),
    extraction("ex_phv", "doc_phv_week", "pdf-parse-mock@1.0.0", 0.97, {
      document_type: "weekly_statement",
      supplier: "Uber",
      statement_period_start: daysAgo(14),
      statement_period_end: daysAgo(7),
      total: 842.16,
      currency: "GBP",
      work_stream_hint: "phv",
      suggested_category_code: "inc_phv",
      direction_hint: "inflow",
      confidence_breakdown: { supplier: 0.99, total: 0.97, period: 0.95 },
    }),
    extraction("ex_parking", "doc_parking", "ocr-mock@1.2.0", 0.58, {
      document_type: "receipt",
      supplier: "NCP",
      date: daysAgo(2),
      total: 14.5,
      currency: "GBP",
      work_stream_hint: "phv",
      suggested_category_code: "exp_parking",
      direction_hint: "outflow",
      confidence_breakdown: { supplier: 0.62, total: 0.51, date: 0.6 },
    }),
  ];

  // -----------------------------------------------------------------------
  // Transactions (unified ledger)
  // -----------------------------------------------------------------------
  const txns: Transaction[] = [];
  const tx = (t: Partial<Transaction> & {
    id: string;
    transaction_date: string;
    description: string;
    amount: number;
    direction: Transaction["direction"];
    kind: Transaction["kind"];
  }): Transaction => ({
    user_id: u,
    account_id: "acc_personal",
    work_stream_id: null,
    category_id: null,
    posted_date: t.transaction_date,
    ownership_type: "personal",
    counterparty: null,
    currency: "GBP",
    business_use_pct: 100,
    tax_relevant: false,
    recurring_rule_id: null,
    linked_document_id: null,
    linked_bill_id: null,
    linked_debt_id: null,
    transfer_group_id: null,
    reconciliation_status: "unreconciled",
    review_status: "none",
    notes: null,
    created_at: iso(0),
    updated_at: iso(0),
    ...t,
  });

  // PHV income (weekly payouts) + fuel
  txns.push(
    tx({ id: "t_phv1", transaction_date: daysAgo(7), description: "Uber weekly payout", counterparty: "Uber BV", amount: 842.16, direction: "inflow", kind: "income", account_id: "acc_business", work_stream_id: ws.phv.id, category_id: cid("inc_phv"), ownership_type: "business", tax_relevant: true, linked_document_id: "doc_phv_week", reconciliation_status: "reconciled" }),
    tx({ id: "t_phv2", transaction_date: daysAgo(14), description: "Uber weekly payout", counterparty: "Uber BV", amount: 765.4, direction: "inflow", kind: "income", account_id: "acc_business", work_stream_id: ws.phv.id, category_id: cid("inc_phv"), ownership_type: "business", tax_relevant: true, reconciliation_status: "reconciled" }),
    tx({ id: "t_phv3", transaction_date: daysAgo(21), description: "Bolt weekly payout", counterparty: "Bolt", amount: 410.22, direction: "inflow", kind: "income", account_id: "acc_business", work_stream_id: ws.phv.id, category_id: cid("inc_phv"), ownership_type: "business", tax_relevant: true }),
    tx({ id: "t_fuel1", transaction_date: daysAgo(5), description: "Shell fuel", counterparty: "Shell", amount: 62.4, direction: "outflow", kind: "expense", account_id: "acc_business", work_stream_id: ws.phv.id, category_id: cid("exp_fuel"), ownership_type: "business", tax_relevant: true, business_use_pct: 100, linked_document_id: "doc_fuel", reconciliation_status: "reconciled" }),
    tx({ id: "t_fuel2", transaction_date: daysAgo(12), description: "BP fuel", counterparty: "BP", amount: 58.1, direction: "outflow", kind: "expense", account_id: "acc_business", work_stream_id: ws.phv.id, category_id: cid("exp_fuel"), ownership_type: "business", tax_relevant: true }),
    tx({ id: "t_platform", transaction_date: daysAgo(7), description: "Uber service fee", counterparty: "Uber BV", amount: 210.54, direction: "outflow", kind: "expense", account_id: "acc_business", work_stream_id: ws.phv.id, category_id: cid("exp_platform_fee"), ownership_type: "business", tax_relevant: true }),
    tx({ id: "t_carwash", transaction_date: daysAgo(9), description: "Car wash", counterparty: "Shine Hand Wash", amount: 12.0, direction: "outflow", kind: "expense", account_id: "acc_cash", work_stream_id: ws.phv.id, category_id: cid("exp_cleaning"), ownership_type: "business", tax_relevant: true, review_status: "needs_review" }),
    tx({ id: "t_phv_parking", transaction_date: daysAgo(2), description: "NCP parking", counterparty: "NCP", amount: 14.5, direction: "outflow", kind: "expense", account_id: "acc_personal", work_stream_id: ws.phv.id, category_id: cid("exp_parking"), ownership_type: "business", tax_relevant: true, linked_document_id: "doc_parking", review_status: "needs_review" }),
  );

  // Trade plate work — wage only (operator covers all running costs)
  txns.push(
    tx({ id: "t_tp1", transaction_date: daysAgo(10), description: "Trade plate weekly wage — Movex", counterparty: "Movex", amount: 620.0, direction: "inflow", kind: "income", account_id: "acc_personal", work_stream_id: ws.trade_plate.id, category_id: cid("inc_trade_plate"), ownership_type: "business" }),
    tx({ id: "t_tp4", transaction_date: daysAgo(17), description: "Trade plate weekly wage — Movex", counterparty: "Movex", amount: 585.0, direction: "inflow", kind: "income", account_id: "acc_personal", work_stream_id: ws.trade_plate.id, category_id: cid("inc_trade_plate"), ownership_type: "business" }),
  );

  // Design work
  txns.push(
    tx({ id: "t_design1", transaction_date: daysAgo(12), description: "Design invoice #0042 — Brightside Ltd", counterparty: "Brightside Ltd", amount: 1200.0, direction: "inflow", kind: "income", account_id: "acc_business", work_stream_id: ws.design.id, category_id: cid("inc_design"), ownership_type: "business", tax_relevant: true, linked_document_id: "doc_invoice", reconciliation_status: "reconciled" }),
    tx({ id: "t_design2", transaction_date: daysAgo(20), description: "Adobe Creative Cloud", counterparty: "Adobe", amount: 56.98, direction: "outflow", kind: "expense", account_id: "acc_business", work_stream_id: ws.design.id, category_id: cid("exp_software"), ownership_type: "business", tax_relevant: true }),
    tx({ id: "t_design3", transaction_date: daysAgo(40), description: "Wacom tablet", counterparty: "Amazon", amount: 189.99, direction: "outflow", kind: "expense", account_id: "acc_business", work_stream_id: ws.design.id, category_id: cid("exp_equipment"), ownership_type: "business", tax_relevant: true }),
  );

  // Freelance
  txns.push(
    tx({ id: "t_free1", transaction_date: daysAgo(18), description: "Freelance dev — retainer", counterparty: "Northwind Co", amount: 600.0, direction: "inflow", kind: "income", account_id: "acc_business", work_stream_id: ws.freelance.id, category_id: cid("inc_freelance"), ownership_type: "business", tax_relevant: true }),
    tx({ id: "t_free2", transaction_date: daysAgo(22), description: "GitHub Copilot", counterparty: "GitHub", amount: 8.0, direction: "outflow", kind: "expense", account_id: "acc_business", work_stream_id: ws.freelance.id, category_id: cid("exp_software"), ownership_type: "business", tax_relevant: true }),
  );

  // Mixed-use (phone 70% business)
  txns.push(
    tx({ id: "t_mobile", transaction_date: daysAgo(6), description: "EE mobile bill", counterparty: "EE", amount: 35.0, direction: "outflow", kind: "expense", account_id: "acc_personal", work_stream_id: null, category_id: cid("exp_mobile"), ownership_type: "mixed", business_use_pct: 70, tax_relevant: true, linked_bill_id: "bill_phone" }),
  );

  // Personal living costs
  txns.push(
    tx({ id: "t_rent", transaction_date: daysAgo(15), description: "Rent", counterparty: "Landlord", amount: 1100.0, direction: "outflow", kind: "expense", account_id: "acc_personal", category_id: cid("exp_housing"), ownership_type: "personal", linked_bill_id: "bill_rent" }),
    tx({ id: "t_council", transaction_date: daysAgo(15), description: "Council tax", counterparty: "City Council", amount: 165.0, direction: "outflow", kind: "expense", account_id: "acc_personal", category_id: cid("exp_council_tax"), ownership_type: "personal", linked_bill_id: "bill_council" }),
    tx({ id: "t_groceries1", transaction_date: daysAgo(3), description: "Tesco", counterparty: "Tesco", amount: 72.34, direction: "outflow", kind: "expense", account_id: "acc_personal", category_id: cid("exp_groceries"), ownership_type: "personal" }),
    tx({ id: "t_groceries2", transaction_date: daysAgo(10), description: "Aldi", counterparty: "Aldi", amount: 41.2, direction: "outflow", kind: "expense", account_id: "acc_personal", category_id: cid("exp_groceries"), ownership_type: "personal" }),
    tx({ id: "t_dining", transaction_date: daysAgo(4), description: "Nando's", counterparty: "Nando's", amount: 27.5, direction: "outflow", kind: "expense", account_id: "acc_credit", category_id: cid("exp_dining"), ownership_type: "personal" }),
    tx({ id: "t_utilities", transaction_date: daysAgo(8), description: "Octopus Energy", counterparty: "Octopus", amount: 96.0, direction: "outflow", kind: "expense", account_id: "acc_personal", category_id: cid("exp_utilities"), ownership_type: "personal", linked_bill_id: "bill_energy" }),
    tx({ id: "t_spotify", transaction_date: daysAgo(11), description: "Spotify", counterparty: "Spotify", amount: 11.99, direction: "outflow", kind: "expense", account_id: "acc_personal", category_id: cid("exp_entertainment"), ownership_type: "personal" }),
    tx({ id: "t_anomaly", transaction_date: daysAgo(1), description: "Currys — laptop", counterparty: "Currys", amount: 1299.0, direction: "outflow", kind: "expense", account_id: "acc_credit", category_id: cid("exp_shopping"), ownership_type: "personal", review_status: "needs_review", notes: "Unusually high — flagged by anomaly detector" }),
  );

  // Transfers (tax pot + savings)
  txns.push(
    tx({ id: "t_tf_out", transaction_date: daysAgo(7), description: "Transfer to Tax Pot", amount: 250.0, direction: "outflow", kind: "transfer", account_id: "acc_business", category_id: cid("tr_transfer"), ownership_type: "business", transfer_group_id: "grp_taxpot", reconciliation_status: "reconciled" }),
    tx({ id: "t_tf_in", transaction_date: daysAgo(7), description: "Transfer from Business", amount: 250.0, direction: "inflow", kind: "transfer", account_id: "acc_taxpot", category_id: cid("tr_transfer"), ownership_type: "business", transfer_group_id: "grp_taxpot", reconciliation_status: "reconciled" }),
    tx({ id: "t_sav_out", transaction_date: daysAgo(16), description: "Transfer to Savings", amount: 200.0, direction: "outflow", kind: "transfer", account_id: "acc_personal", category_id: cid("tr_transfer"), ownership_type: "personal", transfer_group_id: "grp_sav" }),
    tx({ id: "t_sav_in", transaction_date: daysAgo(16), description: "Transfer from Current", amount: 200.0, direction: "inflow", kind: "savings", account_id: "acc_savings", category_id: cid("sav_general"), ownership_type: "personal", transfer_group_id: "grp_sav" }),
  );

  // Debt payments
  txns.push(
    tx({ id: "t_cc_pay", transaction_date: daysAgo(13), description: "Credit card payment", amount: 200.0, direction: "outflow", kind: "debt_payment", account_id: "acc_personal", category_id: cid("debt_cc"), ownership_type: "personal", linked_debt_id: "debt_cc" }),
    tx({ id: "t_car_pay", transaction_date: daysAgo(15), description: "Car finance payment", amount: 289.0, direction: "outflow", kind: "debt_payment", account_id: "acc_business", category_id: cid("debt_loan"), ownership_type: "business", linked_debt_id: "debt_car", tax_relevant: true, work_stream_id: ws.phv.id }),
  );

  ds.transactions = txns;

  // -----------------------------------------------------------------------
  // Bills & subscriptions
  // -----------------------------------------------------------------------
  const bill = (
    id: string,
    name: string,
    amount: number,
    due_day: number,
    freq: Bill["frequency"],
    catCode: string,
    account_id: string,
    autopay = true,
  ): Bill => ({
    id,
    user_id: u,
    name,
    category_id: cid(catCode),
    amount_estimate: amount,
    due_day,
    frequency: freq,
    account_id,
    autopay,
    active: true,
    notes: null,
    created_at: iso(200),
  });
  ds.bills = [
    bill("bill_rent", "Rent", 1100, 1, "monthly", "exp_housing", "acc_personal"),
    bill("bill_council", "Council Tax", 165, 1, "monthly", "exp_council_tax", "acc_personal"),
    bill("bill_energy", "Octopus Energy", 96, 8, "monthly", "exp_utilities", "acc_personal"),
    bill("bill_phone", "EE Mobile", 35, 6, "monthly", "exp_mobile", "acc_personal"),
    bill("bill_vehicle_ins", "Vehicle Insurance (PHV)", 142, 20, "monthly", "exp_vehicle_ins", "acc_business"),
    bill("bill_water", "Water", 32, 25, "monthly", "exp_utilities", "acc_personal"),
  ];

  const sub = (
    id: string,
    name: string,
    amount: number,
    cycle: Subscription["billing_cycle"],
    nextDays: number,
    catCode: string,
    account_id: string,
  ): Subscription => ({
    id,
    user_id: u,
    name,
    amount_estimate: amount,
    billing_cycle: cycle,
    next_due_date: inDays(nextDays),
    category_id: cid(catCode),
    account_id,
    active: true,
    created_at: iso(200),
  });
  ds.subscriptions = [
    sub("sub_adobe", "Adobe Creative Cloud", 56.98, "monthly", 9, "exp_software", "acc_business"),
    sub("sub_chatgpt", "ChatGPT Plus", 20.0, "monthly", 3, "exp_software", "acc_business"),
    sub("sub_spotify", "Spotify", 11.99, "monthly", 12, "exp_entertainment", "acc_personal"),
    sub("sub_github", "GitHub Copilot", 8.0, "monthly", 22, "exp_software", "acc_business"),
    sub("sub_icloud", "iCloud+", 2.99, "monthly", 1, "exp_software", "acc_personal"),
  ];

  // -----------------------------------------------------------------------
  // Debts
  // -----------------------------------------------------------------------
  const debt = (
    id: string,
    name: string,
    type: Debt["debt_type"],
    lender: string,
    original: number,
    current: number,
    apr: number,
    minPay: number,
    due_day: number,
    account_id: string | null = null,
  ): Debt => ({
    id,
    user_id: u,
    name,
    debt_type: type,
    lender,
    account_id,
    original_balance: original,
    current_balance: current,
    apr,
    minimum_payment: minPay,
    due_day,
    status: "active",
    created_at: iso(300),
  });
  ds.debts = [
    debt("debt_cc", "Barclaycard", "credit_card", "Barclaycard", 3500, 2340.18, 24.9, 75, 18, "acc_credit"),
    debt("debt_car", "Car Finance (PCP)", "car_finance", "Black Horse", 14000, 8650.0, 9.9, 289, 15),
    debt("debt_bnpl", "Klarna", "bnpl", "Klarna", 600, 240.0, 0, 60, 28),
    debt("debt_tax", "Self Assessment 24/25", "tax", "HMRC", 4200, 4200.0, 0, 0, 31),
  ];

  const dp = (
    id: string,
    debt_id: string,
    txn: string | null,
    days: number,
    amount: number,
    principal: number,
    interest: number,
  ): DebtPayment => ({
    id,
    debt_id,
    transaction_id: txn,
    payment_date: daysAgo(days),
    amount,
    principal_amount: principal,
    interest_amount: interest,
    fees_amount: 0,
    created_at: iso(days),
  });
  ds.debtPayments = [
    dp("dp_cc1", "debt_cc", "t_cc_pay", 13, 200, 152, 48),
    dp("dp_cc2", "debt_cc", null, 43, 200, 150, 50),
    dp("dp_car1", "debt_car", "t_car_pay", 15, 289, 218, 71),
    dp("dp_car2", "debt_car", null, 45, 289, 216, 73),
  ];

  // -----------------------------------------------------------------------
  // Savings goals
  // -----------------------------------------------------------------------
  const goal = (
    id: string,
    name: string,
    type: SavingsGoal["goal_type"],
    target: number | null,
    current: number,
    account: string,
    targetDays: number | null,
  ): SavingsGoal => ({
    id,
    user_id: u,
    name,
    target_amount: target,
    current_amount: current,
    linked_account_id: account,
    goal_type: type,
    target_date: targetDays ? inDays(targetDays) : null,
    created_at: iso(200),
  });
  ds.savingsGoals = [
    goal("goal_emergency", "Emergency Fund", "emergency_fund", 6000, 5200, "acc_savings", 240),
    goal("goal_tax", "2025/26 Tax Pot", "tax_pot", 7500, 4120, "acc_taxpot", 280),
    goal("goal_vehicle", "Next Vehicle", "vehicle", 4000, 850, "acc_savings", 365),
  ];

  // -----------------------------------------------------------------------
  // Budgets (current month)
  // -----------------------------------------------------------------------
  const mk = monthKey();
  const budget = (id: string, catCode: string, amount: number, ownership: Budget["ownership_type"]): Budget => ({
    id,
    user_id: u,
    month_key: mk,
    category_id: cid(catCode),
    work_stream_id: null,
    ownership_type: ownership,
    target_amount: amount,
    created_at: iso(30),
  });
  ds.budgets = [
    budget("bud_fuel", "exp_fuel", 280, "business"),
    budget("bud_groceries", "exp_groceries", 400, "personal"),
    budget("bud_dining", "exp_dining", 120, "personal"),
    budget("bud_software", "exp_software", 100, "business"),
    budget("bud_entertainment", "exp_entertainment", 60, "personal"),
    budget("bud_shopping", "exp_shopping", 150, "personal"),
  ];

  // -----------------------------------------------------------------------
  // Bank transactions (raw imported rows; some matched, some not)
  // -----------------------------------------------------------------------
  ds.bankTransactions = [
    { id: "bt_1", user_id: u, account_id: "acc_personal", txn_date: daysAgo(3), description: "TESCO STORES 2245", amount: 72.34, direction: "outflow", balance: 1842.55, source_document_id: "doc_bankcsv", matched_transaction_id: "t_groceries1", reconciliation_status: "reconciled", created_at: iso(3) },
    { id: "bt_2", user_id: u, account_id: "acc_personal", txn_date: daysAgo(4), description: "NANDOS LONDON", amount: 27.5, direction: "outflow", balance: 1914.89, source_document_id: "doc_bankcsv", matched_transaction_id: null, reconciliation_status: "unreconciled", created_at: iso(4) },
    { id: "bt_3", user_id: u, account_id: "acc_personal", txn_date: daysAgo(6), description: "EE LIMITED", amount: 35.0, direction: "outflow", balance: 1942.39, source_document_id: "doc_bankcsv", matched_transaction_id: "t_mobile", reconciliation_status: "reconciled", created_at: iso(6) },
    { id: "bt_4", user_id: u, account_id: "acc_personal", txn_date: daysAgo(2), description: "AMZNMKTPLACE", amount: 18.99, direction: "outflow", balance: 1823.4, source_document_id: "doc_bankcsv", matched_transaction_id: null, reconciliation_status: "unreconciled", created_at: iso(2) },
  ];

  // -----------------------------------------------------------------------
  // Rules (automation)
  // -----------------------------------------------------------------------
  const rule = (
    id: string,
    type: Rule["rule_type"],
    name: string,
    conditions: Rule["conditions_json"],
    actions: Rule["actions_json"],
  ): Rule => ({
    id,
    user_id: u,
    rule_type: type,
    name,
    conditions_json: conditions,
    actions_json: actions,
    active: true,
    created_at: iso(120),
  });
  ds.rules = [
    rule("rule_shell", "merchant", "Shell → Fuel (PHV)", { merchant_contains: ["shell", "bp", "esso"] }, { set_category_code: "exp_fuel", set_work_stream_code: "phv", set_ownership_type: "business", set_tax_relevant: true }),
    rule("rule_uber", "work_stream", "Uber/Bolt → PHV income", { merchant_contains: ["uber", "bolt"] }, { set_work_stream_code: "phv", set_category_code: "inc_phv", set_ownership_type: "business", set_tax_relevant: true }),
    rule("rule_adobe", "merchant", "Adobe → Software (Design)", { merchant_contains: ["adobe"] }, { set_category_code: "exp_software", set_work_stream_code: "design", set_ownership_type: "business", set_tax_relevant: true }),
    rule("rule_tesco", "merchant", "Tesco/Aldi → Groceries", { merchant_contains: ["tesco", "aldi", "sainsbury"] }, { set_category_code: "exp_groceries", set_ownership_type: "personal" }),
  ];

  // -----------------------------------------------------------------------
  // Review tasks
  // -----------------------------------------------------------------------
  const task = (
    id: string,
    type: ReviewTask["task_type"],
    priority: ReviewTask["priority"],
    docId: string | null,
    txnId: string | null,
    payload: ReviewTask["payload_json"],
  ): ReviewTask => ({
    id,
    user_id: u,
    document_id: docId,
    transaction_id: txnId,
    task_type: type,
    priority,
    status: "open",
    payload_json: payload,
    created_at: iso(2),
    completed_at: null,
  });
  ds.reviewTasks = [
    task("rt_parking", "low_confidence_match", "high", "doc_parking", "t_phv_parking", {
      summary: "Low-confidence OCR on NCP parking receipt (58%). Verify amount & date.",
      suggested_action: "Confirm £14.50 on " + daysAgo(2) + " as Parking (PHV, business).",
      suggestion: { document_type: "receipt", supplier: "NCP", date: daysAgo(2), total: 14.5, suggested_category_code: "exp_parking", work_stream_hint: "phv" },
      candidate_transaction_ids: ["t_phv_parking"],
      amount: 14.5,
    }),
    task("rt_dup", "duplicate_upload", "medium", "doc_dup", null, {
      summary: "Possible duplicate of shell-fuel-receipt.jpg (same supplier/amount/date).",
      suggested_action: "Dismiss duplicate or link to existing fuel transaction.",
      candidate_transaction_ids: ["t_fuel1"],
      amount: 62.4,
    }),
    task("rt_evidence", "missing_evidence", "high", null, "t_fuel2", {
      summary: "Tax-relevant expense '£58.10 BP fuel' has no attached receipt.",
      suggested_action: "Upload the BP receipt to support this claim.",
      amount: 58.1,
    }),
    task("rt_taxpot", "tax_pot_suggestion", "medium", null, "t_phv1", {
      summary: "Income received: £842.16. Suggest moving ~£210 (25%) to Tax Pot.",
      suggested_action: "Transfer £210 to Tax Pot.",
      amount: 210,
    }),
    task("rt_anomaly", "anomaly", "high", null, "t_anomaly", {
      summary: "Unusually high spend: £1,299 at Currys (4.8× your category average).",
      suggested_action: "Confirm purchase and categorise correctly.",
      amount: 1299,
    }),
    task("rt_unrecon", "unreconciled_transaction", "low", null, null, {
      summary: "2 bank rows are unreconciled (Nando's, Amazon).",
      suggested_action: "Match to ledger transactions or create new ones.",
      candidate_transaction_ids: ["bt_2", "bt_4"],
    }),
  ];

  // -----------------------------------------------------------------------
  // Audit log
  // -----------------------------------------------------------------------
  ds.auditLog = [
    { id: "al_1", user_id: u, entity_type: "transaction", entity_id: "t_phv1", action: "import", before_json: null, after_json: { description: "Uber weekly payout" }, created_at: iso(7) },
    { id: "al_2", user_id: u, entity_type: "document", entity_id: "doc_fuel", action: "approve", before_json: { review_status: "needs_review" }, after_json: { review_status: "approved" }, created_at: iso(5) },
  ];

  return ds;
}

function extraction(
  id: string,
  document_id: string,
  version: string,
  confidence: number,
  normalized: Extraction["normalized_json"],
): Extraction {
  return {
    id,
    document_id,
    extractor_version: version,
    raw_text: `--- extracted text for ${document_id} ---`,
    raw_json: { detected_document_type: normalized.document_type, ocr_engine: version },
    normalized_json: normalized,
    confidence_score: confidence,
    created_at: iso(2),
  };
}
