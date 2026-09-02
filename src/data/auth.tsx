import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/** Only these accounts may sign in. Enforced client-side here and server-side
 *  by an allowlist trigger on auth.users (migration 0008). */
export const ALLOWED_EMAILS = [
  "aqakhtargroup@gmail.com",
  "aqakhtar96@gmail.com",
] as const;

export function isEmailAllowed(email: string): boolean {
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase() as (typeof ALLOWED_EMAILS)[number]);
}

interface AuthContextValue {
  /** Whether a Supabase project is configured (URL + anon key present). */
  configured: boolean;
  /** True until the initial session check resolves. */
  loading: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
  /** Display name from auth metadata, once the user sets one. */
  fullName: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Create an account (allowlisted email only). */
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback<AuthContextValue["signIn"]>(
    async (email, password) => {
      if (!supabase) return { error: "Supabase is not configured." };
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signUp = useCallback<AuthContextValue["signUp"]>(
    async (email, password) => {
      const clean = email.trim().toLowerCase();
      if (!isEmailAllowed(clean)) {
        return { error: "This email isn't permitted to sign in to this app." };
      }
      if (!supabase) return { error: "Supabase is not configured." };
      const { error } = await supabase.auth.signUp({ email: clean, password });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setSession(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      fullName: (session?.user.user_metadata?.full_name as string | undefined) ?? null,
      signIn,
      signUp,
      signOut,
    }),
    [loading, session, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
