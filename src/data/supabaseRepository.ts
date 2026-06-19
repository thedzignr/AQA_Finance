import { getSupabase } from "@/lib/supabase";
import {
  COLLECTION_TABLE,
  type CollectionMap,
  type CollectionName,
  type Dataset,
  emptyDataset,
} from "./dataset";
import type { Repository } from "./repository";
import type { Profile } from "@/types/domain";

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
type QueryResult = { data: unknown; error: { message: string } | null };

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
        console.error(`Failed loading ${name}:`, error.message);
        return;
      }
      (ds[name] as unknown) = (data as unknown[]) ?? [];
    });

    return ds;
  }

  async insert<K extends CollectionName>(name: K, row: CollectionMap[K]) {
    const { data, error } = (await this.table(name)
      .insert(row)
      .select()
      .single()) as QueryResult;
    if (error) throw new Error(error.message);
    return ((data as CollectionMap[K]) ?? row) as CollectionMap[K];
  }

  async update<K extends CollectionName>(
    name: K,
    id: string,
    patch: Partial<CollectionMap[K]>,
  ) {
    const { error } = (await this.table(name)
      .update(patch)
      .eq("id", id)) as QueryResult;
    if (error) throw new Error(error.message);
  }

  async remove<K extends CollectionName>(name: K, id: string) {
    const { error } = (await this.table(name).delete().eq("id", id)) as QueryResult;
    if (error) throw new Error(error.message);
  }
}
