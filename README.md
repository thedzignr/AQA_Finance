# AQA Finance

A production-minded **personal finance & self-employed money management** web app
for the UK. Built for a sole trader running multiple work streams — **PHV /
private hire, trade plate driving, design, freelance and other income** — who
needs one unified ledger that doubles as tax-ready record keeping for **2025/26**.

> Runs fully offline out of the box against seeded demo data, and is wired to
> drop straight onto **Supabase** (Postgres + RLS + Storage) when you add keys.

---

## What it does

- **One unified ledger** for every money movement across multiple accounts
  (current, savings, credit card, cash, loan, tax pot).
- **Personal / business / mixed** classification on every transaction, with
  business-use % apportionment for mixed-use costs.
- **Work-stream tagging** (PHV, trade plate, design, freelance, other) with
  income, expense and net-profit reporting per stream. Streams can be
  **wage-only** (e.g. trade plate driving paid as a wage with all running costs
  on the operator's company card) — these record income only and are flagged
  "expenses covered by operator" in reporting.
- **Weekly operator statement upload** straight from the dashboard: drop your
  PHV (Uber/Bolt) weekly PDF and it auto-posts gross fares as income and the
  platform fee as an allowable expense, tagged tax-relevant and linked to the
  statement (low-confidence parses go to the review queue instead).
- **Document ingestion** for receipts, invoices, weekly operator/PHV statements,
  bank statements, screenshots, CSVs and PDFs — auto-classified, parsed and
  confidence-scored. A **receive-only mailbox** can ingest parking tickets,
  invoices and receipts sent as email attachments into the same pipeline.
- **Review queue** with a keyboard-driven workflow for low-confidence OCR/parse
  results (approve / reject / link / create / dismiss).
- **Bills & subscriptions**, **debts** (APR, minimum payments, payoff timeline),
  **budgets** (planned vs actual, personal vs business) and **savings/tax pots**.
- **Tax & Records**: 2025/26 income summary, allowable expenses, evidence
  coverage, per-work-stream summaries and an accountant-ready CSV export.
- **Insights**: recurring-bill detection, duplicate-upload detection, anomaly
  flags, tax-pot suggestions and unreconciled-row alerts.

---

## Tech stack

| Concern        | Choice                                            |
| -------------- | ------------------------------------------------- |
| Build / dev    | Vite 5                                             |
| UI             | React 18 + TypeScript                             |
| Styling        | Tailwind CSS + shadcn/ui (Radix primitives)       |
| Charts         | Recharts                                           |
| Routing        | React Router 6                                     |
| Backend        | Supabase (Postgres, RLS, Storage) — optional      |
| Icons          | lucide-react                                       |

---

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

That's it — the app boots with a **seeded demo profile** (Alex Rivera) and full
sample data. No backend or environment variables required.

Other scripts:

```bash
npm run build      # type-check (tsc -b) + production build
npm run preview    # preview the production build
npm run typecheck  # type-check only
npm run lint       # eslint
```

### Demo controls

- Top-bar **refresh** reloads from the active backend.
- Top-bar **reset** (mock mode only) restores the seed data.
- Theme toggle switches light/dark (defaults to dark).

Demo data is persisted to `localStorage` (`aqa_finance_dataset_v1`), so your
edits survive reloads until you reset.

---

## Connecting Supabase

1. Create a Supabase project.
2. Run the SQL migrations in order (SQL editor or Supabase CLI):
   - `supabase/migrations/0001_init_schema.sql` — enums, tables, indexes,
     constraints, triggers.
   - `supabase/migrations/0002_rls_policies.sql` — row-level security + a
     private `documents` storage bucket.
   - `supabase/migrations/0003_seed_defaults.sql` — shared default categories
     and a `seed_user_defaults(uuid)` bootstrap function.
3. Copy `.env.example` to `.env` and fill in:

   ```env
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=ey...
   VITE_DATA_BACKEND=supabase
   ```

4. Restart `npm run dev`. The app now reads/writes live Postgres with RLS
   scoping every row to the signed-in user.

> With `VITE_DATA_BACKEND=mock` (or blank keys) the app stays in offline demo
> mode. The data shapes are identical, so nothing else changes.

---

## Receive-only receipts inbox

Forward parking tickets, invoices and receipts to a mailbox that **cannot send**.
Resend delivers `email.received` to `POST /api/inbound-email`, which stores the
attachment in Supabase Storage and opens a Review task. The app never calls
Resend's send API.

1. Install Resend on the Vercel project (marketplace: `resend/resend-email`).
   Receiving can use the Resend-managed `*.resend.app` address so you do **not**
   point MX at an existing mailbox domain.
2. Create a Resend webhook for `email.received` → `https://<prod>/api/inbound-email`.
3. Set server env vars (never `VITE_` except the displayed address):

   ```env
   RESEND_API_KEY=
   RESEND_WEBHOOK_SECRET=
   SUPABASE_SERVICE_ROLE_KEY=
   AQA_INGEST_USER_ID=
   VITE_INBOUND_MAILBOX=receipts@xxxx.resend.app
   ```

4. Put that address on barriers, fuel apps and supplier invoices. Refresh the
   app after mail arrives, then confirm the item in Review.

Local `npm run dev` does not serve `/api`. Use a deployed URL (or `vercel dev`)
for the webhook.

---

## Architecture

```
src/
  components/
    ui/             shadcn/ui primitives (button, card, table, dialog, …)
    layout/         AppLayout, sidebar/topbar, nav config
    shared/         StatCard, Money, PageHeader, status badges, empty state
    transactions/   TransactionDialog (shared add/edit form)
  data/
    dataset.ts          Dataset shape + collection<->table mapping
    seed.ts             Deterministic demo dataset builder
    repository.ts       Backend-agnostic Repository interface
    mockRepository.ts   localStorage-backed implementation (default)
    supabaseRepository.ts  Live Postgres implementation
    DataProvider.tsx    React context: load, CRUD, lookups, optimistic state
  lib/
    selectors.ts    Derived views (dashboard, work streams, tax, cashflow)
    insights.ts     Detection/automation (recurring, dup, anomaly, tax-pot)
    parsing.ts      Document OCR/parse pipeline + mock adapters
    supabase.ts     Typed client + backend switch
    utils.ts        Formatting (GBP), ids, dates, checksum
  pages/            One file per screen
  types/
    domain.ts       Single source of truth for the data model
    supabase.ts     Database typing for the typed client
supabase/migrations/  SQL schema, RLS, seed
```

### Data flow

The UI never talks to a backend directly. It calls `useData()` (from
`DataProvider`), which delegates to a **`Repository`**. Two implementations
satisfy the same interface:

- `MockRepository` — in-memory + `localStorage`, seeded from `seed.ts`.
- `SupabaseRepository` — live Postgres, RLS-scoped.

This keeps screens backend-agnostic and means the demo and production paths use
**the same production-shaped data structures** (no throwaway local-only models).

### Document → transaction traceability

Raw extraction output (`extractions.raw_json` / `normalized_json`) is stored
**separately** from approved ledger data. Original files are never mutated.
Tax-relevant transactions carry `linked_document_id`, and the Tax screen reports
**evidence coverage** plus a "missing evidence" list so every claim is
traceable.

---

## OCR / parsing pipeline (`src/lib/parsing.ts`)

`processDocument(input)` auto-detects the document type and dispatches to an
adapter:

| Adapter             | Handles                          | Output                                   |
| ------------------- | -------------------------------- | ---------------------------------------- |
| `receipt-ocr`       | JPG/PNG/HEIC receipts, screenshots | supplier, date, total, VAT, hints       |
| `phv-pdf-parser`    | Uber/Bolt weekly statements (PDF) | period, gross, fees, net payout         |
| `csv-bank-parser`   | Bank statement CSVs               | parsed transaction rows + balances      |

Each result is **confidence-scored**; anything below threshold is routed to the
**Review Queue** as a `review_task`. Work-stream and category hints come from
merchant/source heuristics (`hintWorkStream`, `hintCategory`).

The **Documents** screen includes one-click samples for each adapter so the
pipeline is demoable without real files. **Recurring-bill detection** (the 4th
"adapter") lives in `src/lib/insights.ts` and surfaces on the Bills screen.

### Extension points

- **Real OCR/AI** — replace the body of the adapters in `parsing.ts` with calls
  to Tesseract, AWS Textract, Google Document AI, or an LLM. The
  `ParseResult` contract (and the `extractions` table) stays the same.
- **Bank feeds / open banking** — the `bank_transactions` table already models
  raw imported rows with `matched_transaction_id` + `reconciliation_status`.
  Add a TrueLayer/Plaid/Nordigen importer that writes `bank_transactions`, then
  reuse the existing matching/reconciliation surface.
- **Automation rules** — the `rules` table (`conditions_json` / `actions_json`)
  is modelled and seeded; wire a rule engine over `processDocument` and the
  transaction create path to auto-categorise and tag.
- **New work streams / categories** — add rows to `work_streams` /
  `transaction_categories`; the UI is data-driven.

---

## Database schema

24 enums and the following tables (see `supabase/migrations/0001_init_schema.sql`):

`profiles`, `accounts`, `work_streams`, `transaction_categories`,
`transactions`, `transaction_splits`, `documents`, `document_pages`,
`extractions`, `bills`, `subscriptions`, `debts`, `debt_payments`,
`savings_goals`, `budgets`, `bank_transactions`, `rules`, `review_tasks`,
`audit_log`.

All user-owned tables have RLS enabled and are scoped via `auth.uid()`. Child
tables (splits, pages, extractions, debt payments) are guarded through their
parent's ownership. System default categories (`user_id IS NULL`) are
world-readable, write-protected.

---

## UK tax notes

Estimates use 2025/26 assumptions (£12,570 personal allowance, 20%/40% income
tax bands, 6%/2% Class 4 NIC). They are **indicative only** and exclude Class 2
NIC, payments on account and allowances/reliefs specific to your situation. Use
the CSV export with your accountant.

---

## Roadmap / not yet implemented

- Authentication UI (Supabase Auth is wired; sign-in screen is a follow-up).
- Server-side document storage upload (paths are modelled; bucket is created).

### Recently added

- **Split-transaction editor** — allocate one transaction across multiple
  categories, work streams and business-use percentages with a live balance
  check (`transaction_splits`, full CRUD). Available from the row actions on the
  Transactions screen; split rows are badged in the ledger.
- **Transfer linking** — pair a transaction with its matching counterpart on
  another account (sets `transfer_group_id`, `kind = transfer`, reconciliation
  matched) so internal movements aren't double-counted in cashflow.
- **Route-level code-splitting** — every screen is lazy-loaded and vendor
  chunks (`react`, `recharts`, `supabase`) are split out, keeping the initial
  bundle lean.
