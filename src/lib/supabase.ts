import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const backend = (import.meta.env.VITE_DATA_BACKEND as string | undefined) ?? "mock";

export const isSupabaseConfigured = Boolean(
  url && anonKey && backend === "supabase",
);

/**
 * Returns a typed Supabase client, or null when the app is running in the
 * default offline "mock" mode. Keeping this lazy means the bundle works with no
 * environment configured at all.
 */
let client: SupabaseClient<Database> | null = null;
export function getSupabase(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient<Database>(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export const dataBackend = isSupabaseConfigured ? "supabase" : "mock";
