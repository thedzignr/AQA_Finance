import type { DocumentType, Json, ReviewStatus } from '../types/database';

export type ParsedDocument = {
  adapter: string;
  documentType: DocumentType;
  extractedText: string;
  normalized: {
    date?: string;
    supplier?: string;
    totalAmount?: number;
    vatAmount?: number;
    statementPeriod?: { start: string; end: string };
    workStreamHint?: 'phv' | 'trade_plate' | 'design' | 'freelance' | 'other';
    suggestedCategoryCode?: string;
    suggestedTransactionDescription?: string;
  };
  rawJson: Json;
  confidence: number;
  reviewStatus: ReviewStatus;
  suggestedMatches: Array<{
    transactionId?: string;
    reason: string;
    score: number;
  }>;
};

export type DocumentAdapter = {
  id: string;
  label: string;
  accepts: string[];
  parse: (file: File) => Promise<ParsedDocument>;
};

const reviewStatusFor = (confidence: number): ReviewStatus =>
  confidence >= 0.82 ? 'approved' : 'needs_review';

export const receiptPhotoAdapter: DocumentAdapter = {
  id: 'mock-receipt-photo',
  label: 'Receipt photo OCR',
  accepts: ['image/jpeg', 'image/png', 'image/heic'],
  async parse(file) {
    const confidence = file.name.toLowerCase().includes('blur') ? 0.56 : 0.78;

    return {
      adapter: this.id,
      documentType: 'receipt',
      extractedText: 'SHELL SERVICE STATION\nFuel unleaded\nTotal GBP 72.36\nVAT GBP 12.06',
      normalized: {
        date: '2026-06-13',
        supplier: 'Shell',
        totalAmount: 72.36,
        vatAmount: confidence > 0.7 ? 12.06 : undefined,
        workStreamHint: 'phv',
        suggestedCategoryCode: 'expense_fuel',
        suggestedTransactionDescription: 'Fuel receipt',
      },
      rawJson: {
        ocrEngine: 'mock',
        fileName: file.name,
        blocks: ['supplier', 'line_items', 'vat', 'total'],
      },
      confidence,
      reviewStatus: reviewStatusFor(confidence),
      suggestedMatches: [{ reason: 'Same merchant and amount within 2 days', score: 0.83 }],
    };
  },
};

export const pdfWeeklyPhvStatementAdapter: DocumentAdapter = {
  id: 'mock-pdf-weekly-phv',
  label: 'PDF weekly PHV statement parser',
  accepts: ['application/pdf'],
  async parse(file) {
    return {
      adapter: this.id,
      documentType: 'weekly_statement',
      extractedText: 'Bolt weekly statement\nPeriod 2026-06-08 to 2026-06-14\nNet payout GBP 812.45',
      normalized: {
        supplier: 'Bolt',
        totalAmount: 812.45,
        statementPeriod: { start: '2026-06-08', end: '2026-06-14' },
        workStreamHint: 'phv',
        suggestedCategoryCode: 'income_phv',
        suggestedTransactionDescription: 'PHV weekly operator payout',
      },
      rawJson: {
        parser: 'mock-text-pdf',
        fileName: file.name,
        settlementRows: 24,
        deductions: ['platform_fee', 'insurance_contribution'],
      },
      confidence: 0.92,
      reviewStatus: 'approved',
      suggestedMatches: [{ transactionId: 'txn-phv', reason: 'Payout amount/date matches ledger transaction', score: 0.94 }],
    };
  },
};

export const csvBankStatementAdapter: DocumentAdapter = {
  id: 'mock-csv-bank-statement',
  label: 'CSV bank statement parser',
  accepts: ['text/csv', 'application/vnd.ms-excel'],
  async parse(file) {
    return {
      adapter: this.id,
      documentType: 'bank_statement',
      extractedText: 'date,description,amount,balance\n2026-06-13,Shell fuel,-72.36,2380.00',
      normalized: {
        date: '2026-06-13',
        supplier: 'Monzo',
        totalAmount: 72.36,
        suggestedTransactionDescription: 'Imported bank statement rows',
      },
      rawJson: {
        parser: 'mock-csv',
        fileName: file.name,
        rows: [
          { date: '2026-06-13', description: 'Shell fuel', amount: -72.36, balance: 2380 },
          { date: '2026-06-15', description: 'Bolt payout', amount: 812.45, balance: 4210 },
        ],
      },
      confidence: 0.98,
      reviewStatus: 'approved',
      suggestedMatches: [
        { transactionId: 'txn-fuel', reason: 'Description and amount match existing transaction', score: 0.88 },
        { transactionId: 'txn-phv', reason: 'Imported payout reconciles existing PHV income', score: 0.96 },
      ],
    };
  },
};

export type BillDetectionResult = {
  merchant: string;
  averageAmount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  confidence: number;
  nextDueDate: string;
  suggestedAction: 'create_bill' | 'link_existing_bill' | 'review';
};

export function detectMonthlyBillsFromBankRows(): BillDetectionResult[] {
  return [
    {
      merchant: 'Vehicle insurance',
      averageAmount: 178,
      frequency: 'monthly',
      confidence: 0.91,
      nextDueDate: '2026-06-18',
      suggestedAction: 'link_existing_bill',
    },
    {
      merchant: 'Adobe Creative Cloud',
      averageAmount: 56.98,
      frequency: 'monthly',
      confidence: 0.87,
      nextDueDate: '2026-06-28',
      suggestedAction: 'create_bill',
    },
  ];
}

export const documentAdapters = [
  receiptPhotoAdapter,
  pdfWeeklyPhvStatementAdapter,
  csvBankStatementAdapter,
];
