import type { CollectionMap, CollectionName, Dataset } from "./dataset";

/**
 * Backend-agnostic persistence contract. The UI never talks to a backend
 * directly — it goes through a `Repository`. The live implementation is
 * `SupabaseRepository` (Postgres + RLS, scoped to the authenticated user).
 */
export interface Repository {
  readonly backend: "supabase";
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
}
