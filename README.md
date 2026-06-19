# LedgerFlow UK Finance

A production-minded React, TypeScript, Tailwind, shadcn/ui-style and Supabase application for UK personal finance and self-employed sole trader money management.

The app is designed around one unified ledger that can separate personal, business and mixed-use transactions while preserving strong evidence links from uploaded receipts, statements, invoices, PDFs, CSVs and screenshots.

## What is included

- React 19 + TypeScript + Vite
- Tailwind CSS v4 with compact dark-mode-first UI
- Local shadcn/ui-style primitives for cards, buttons, badges, tables and progress
- Supabase SQL migrations with enums, tables, indexes, constraints, triggers and RLS
- Seeded default categories plus per-user onboarding defaults for accounts, work streams and starter rules
- Typed Supabase client and TypeScript database row types
- Required app modules:
  - Home dashboard
  - Accounts
  - Unified transactions ledger
  - Work streams
  - Documents upload and parsing inbox
  - Review queue
  - Bills and subscriptions
  - Debts
  - Budget
  - Tax and records
- Mock adapters for:
  - receipt photo OCR
  - PDF weekly PHV statement parsing
  - CSV bank statement parsing
  - monthly bill detection

## Setup

```bash
npm install
npm run dev
```

For Supabase-backed data, copy `.env.example` to `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

When these values are absent, the app uses a typed demo dataset that mirrors the production tables. This is only for local exploration; the UI, adapters and reports are structured around the Supabase schema.

## Supabase

Migrations live in `supabase/migrations`.

Apply them with the Supabase CLI:

```bash
supabase db push
```

The initial schema includes:

- `profiles`
- `accounts`
- `work_streams`
- `transaction_categories`
- `transactions`
- `transaction_splits`
- `documents`
- `document_pages`
- `extractions`
- `bills`
- `subscriptions`
- `debts`
- `debt_payments`
- `savings_goals`
- `budgets`
- `bank_transactions`
- `rules`
- `review_tasks`
- `audit_log`

RLS is enabled for user-owned records. `transaction_categories` supports global defaults plus user-specific categories.

## Architecture

```text
src/
  App.tsx                    Routed application shell and screens
  components/ui/             shadcn/ui-style primitives
  lib/
    document-adapters.ts     OCR/PDF/CSV adapter contracts and mocks
    finance-data.ts          Supabase data loading, demo records and derived metrics
    supabase.ts              Typed Supabase client
    utils.ts                 Formatting and class helpers
  types/database.ts          Database row and enum types
supabase/migrations/         SQL schema and seeds
```

## Core data principles

1. **Unified ledger:** every income, expense, transfer, debt payment, saving movement and adjustment is represented in `transactions`.
2. **Personal/business separation:** `ownership_type` and `business_use_pct` preserve reporting boundaries even when one bank account is used for mixed spending.
3. **Work-stream attribution:** PHV, trade plate, design, freelance and other income streams are tracked through `work_stream_id`.
4. **Evidence traceability:** `linked_document_id`, document pages and extraction records keep original files separate from approved ledger data.
5. **Review before approval:** low-confidence OCR/parsing and missing evidence flow into `review_tasks`.
6. **Open banking-ready:** `bank_transactions` is intentionally separate from approved `transactions` so imports can be reconciled rather than blindly trusted.

## OCR, AI and bank-feed extension points

`src/lib/document-adapters.ts` defines the adapter contract:

```ts
export type DocumentAdapter = {
  id: string;
  label: string;
  accepts: string[];
  parse: (file: File) => Promise<ParsedDocument>;
};
```

Replace the mock implementations with:

- image OCR: Google Vision, Azure Document Intelligence, AWS Textract, Tesseract, or a multimodal model
- text PDF parsing: `pdf-parse`, Supabase Edge Functions, or a server-side PDF pipeline
- scanned PDF OCR: render pages server-side, OCR each page, write `document_pages`
- CSV bank import: provider-specific mapping profiles and duplicate detection
- AI extraction: store full model response in `extractions.raw_json`, normalized approved fields in `normalized_json`

Open banking providers such as TrueLayer, Plaid, Yapily or Salt Edge can write into `bank_transactions`, then rules and review tasks can reconcile them into the approved ledger.

## UK sole trader reporting notes

The Tax & Records screen is structured for the 2025/26 UK tax year and separates:

- income by work stream
- tax-relevant expenses
- mixed-use business percentage
- evidence coverage
- missing receipt/statement tasks
- export-ready accountant summaries

This app is a record-keeping and workflow tool, not tax advice. Production deployments should add accountant-reviewed category mappings, MTD/SA export requirements when finalized, and formal retention policies.

## Useful scripts

```bash
npm run dev      # start Vite
npm run build    # type-check and build production assets
npm run lint     # run ESLint
npm run preview  # preview built app
```
