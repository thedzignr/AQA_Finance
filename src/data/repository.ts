import type { CollectionMap, CollectionName, Dataset } from "./dataset";

/**
 * Backend-agnostic persistence contract. The UI never talks to a backend
 * directly — it goes through a `Repository`. Two implementations exist:
 *   - MockRepository    (localStorage + seeded demo data, default/offline)
 *   - SupabaseRepository (live Postgres with RLS)
 */
export interface Repository {
  readonly backend: "mock" | "supabase";
  /** Load the full dataset for the current user. */
  loadAll(): Promise<Dataset>;
  insert<K extends CollectionName>(
    name: K,
    row: CollectionMap[K],
  ): Promise<CollectionMap[K]>;
  update<K extends CollectionName>(
    name: K,
    id: string,
    patch: Partial<CollectionMap[K]>,
  ): Promise<void>;
  remove<K extends CollectionName>(name: K, id: string): Promise<void>;
  /** Reset all local data back to the seed (mock backend only). */
  reset?(): Promise<Dataset>;
}
