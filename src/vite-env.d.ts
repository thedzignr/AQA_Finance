/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DATA_BACKEND?: string;
  /** Receive-only mailbox shown in the UI (e.g. receipts@xxxx.resend.app). */
  readonly VITE_INBOUND_MAILBOX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
