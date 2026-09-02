import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** The app is Supabase-backed; it's "configured" once a URL + anon key exist. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Returns a typed Supabase client, or null when no Supabase project is
 * configured (in which case the app shows a "connect Supabase" screen).
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
