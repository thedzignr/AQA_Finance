import {
  COMPANY_PROFILE_META_KEY,
  companyProfileFromUser,
  isMissingRelationError,
  saveCompanyProfileMeta,
} from "@/lib/companyProfileStore";
import { getSupabase } from "@/lib/supabase";
import {
  COLLECTION_TABLE,
  type CollectionMap,
  type CollectionName,
  type Dataset,
  emptyDataset,
} from "./dataset";
import type { Repository } from "./repository";
import type { CompanyProfile, Profile } from "@/types/domain";

/**
 * Live Supabase backend. Relies on RLS to scope rows to the signed-in user, so
 * queries don't need explicit user_id filters (except system categories which
 * are surfaced by the `categories_select` policy automatically).
 *
 * Because table names are resolved dynamically (collection -> table) we use a
 * minimally-typed query accessor; the strong typing lives in the domain model
 * and the typed client is still used for auth + profiles.
 */
// Minimal query result shape we rely on.
type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

export class SupabaseRepository implements Repository {
  readonly backend = "supabase" as const;

  private client() {
    const c = getSupabase();
    if (!c) throw new Error("Supabase client is not configured.");
    return c;
  }

  // Table names are resolved dynamically, so we drop to a loose accessor here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private table(name: CollectionName): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = this.client() as any;
    return c.from(COLLECTION_TABLE[name]);
  }

  async loadAll(): Promise<Dataset> {
    const supabase = this.client();
    const ds = emptyDataset();

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return ds;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    ds.profile = (profile as unknown as Profile) ?? null;

    const names = Object.keys(COLLECTION_TABLE) as CollectionName[];
    const results = (await Promise.all(
      names.map((name) => this.table(name).select("*")),
    )) as QueryResult[];
    names.forEach((name, i) => {
      const { data, error } = results[i];
      if (error) {
        if (name === "companyProfiles" && isMissingRelationError(error)) {
          const fallback = companyProfileFromUser(userData.user);
          ds.companyProfiles = fallback ? [fallback] : [];
          return;
        }
        console.error(`Failed loading ${name}:`, error.message);
        return;
      }
      (ds[name] as unknown) = (data as unknown[]) ?? [];
    });

    if (ds.companyProfiles.length === 0) {
      const fallback = companyProfileFromUser(userData.user);
      if (fallback) {
        ds.companyProfiles = [fallback];
        void this.table("companyProfiles")
          .insert(fallback)
          .then(({ error }: QueryResult) => {
            if (error && !isMissingRelationError(error)) {
              console.error("Failed migrating company profile:", error.message);
            }
          });
      }
    }

    return ds;
  }

  async insert<K extends CollectionName>(name: K, row: CollectionMap[K]) {
    const { data, error } = (await this.table(name)
      .insert(row)
      .select()
      .single()) as QueryResult;
    if (!error) return ((data as CollectionMap[K]) ?? row) as CollectionMap[K];
    if (name === "companyProfiles" && isMissingRelationError(error)) {
      await saveCompanyProfileMeta(row as CompanyProfile);
      return row;
    }
    throw new Error(error.message);
  }

  async update<K extends CollectionName>(
    name: K,
    id: string,
    patch: Partial<CollectionMap[K]>,
  ) {
    const { error } = (await this.table(name)
      .update(patch)
      .eq("id", id)) as QueryResult;
    if (!error) return;
    if (name === "companyProfiles" && isMissingRelationError(error)) {
      const { data: userData } = await this.client().auth.getUser();
      const current = companyProfileFromUser(userData.user);
      const now = new Date().toISOString();
      const merged = {
        entity_type: "limited_company" as const,
        legal_name: "",
        trading_name: null,
        company_number: null,
        vat_registered: false,
        vat_number: null,
        vat_scheme: "none" as const,
        default_vat_rate: 0,
        registered_address: null,
        email: null,
        phone: null,
        website: null,
        bank_name: null,
        bank_sort_code: null,
        bank_account_name: null,
        bank_account_number: null,
        invoice_prefix: "INV",
        next_invoice_number: 1,
        quote_prefix: "QTE",
        next_quote_number: 1,
        default_payment_terms_days: 14,
        default_quote_valid_days: 30,
        invoice_footer: null,
        accounting_year_end_month: 3,
        created_at: now,
        updated_at: now,
        ...current,
        ...patch,
        id,
        user_id: current?.user_id ?? userData.user?.id ?? "",
      } as CompanyProfile;
      await saveCompanyProfileMeta(merged);
      return;
    }
    throw new Error(error.message);
  }

  async remove<K extends CollectionName>(name: K, id: string) {
    const { error } = (await this.table(name).delete().eq("id", id)) as QueryResult;
    if (!error) return;
    if (name === "companyProfiles" && isMissingRelationError(error)) {
      const { error: metaError } = await this.client().auth.updateUser({
        data: { [COMPANY_PROFILE_META_KEY]: null },
      });
      if (metaError) throw new Error(metaError.message);
      return;
    }
    throw new Error(error.message);
  }
}
