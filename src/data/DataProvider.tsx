import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dataBackend } from "@/lib/supabase";
import type {
  Account,
  TransactionCategory,
  WorkStream,
} from "@/types/domain";
import { type CollectionMap, type CollectionName, type Dataset, emptyDataset } from "./dataset";
import { MockRepository } from "./mockRepository";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabaseRepository";

interface DataContextValue {
  backend: "mock" | "supabase";
  loading: boolean;
  error: string | null;
  data: Dataset;
  refresh: () => Promise<void>;
  reset: () => Promise<void>;
  insert: <K extends CollectionName>(
    name: K,
    row: CollectionMap[K],
  ) => Promise<CollectionMap[K]>;
  update: <K extends CollectionName>(
    name: K,
    id: string,
    patch: Partial<CollectionMap[K]>,
  ) => Promise<void>;
  remove: <K extends CollectionName>(name: K, id: string) => Promise<void>;
  // Convenience lookups
  accountById: (id: string | null | undefined) => Account | undefined;
  categoryById: (id: string | null | undefined) => TransactionCategory | undefined;
  categoryByCode: (code: string | null | undefined) => TransactionCategory | undefined;
  workStreamById: (id: string | null | undefined) => WorkStream | undefined;
}

const DataContext = createContext<DataContextValue | null>(null);

function createRepository(): Repository {
  return dataBackend === "supabase" ? new SupabaseRepository() : new MockRepository();
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [repo] = useState<Repository>(() => createRepository());
  const [data, setData] = useState<Dataset>(emptyDataset);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await repo.loadAll();
      setData(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const insert = useCallback<DataContextValue["insert"]>(
    async (name, row) => {
      const saved = await repo.insert(name, row);
      setData((prev) => ({
        ...prev,
        [name]: [...(prev[name] as unknown[]), saved],
      }));
      return saved;
    },
    [repo],
  );

  const update = useCallback<DataContextValue["update"]>(
    async (name, id, patch) => {
      await repo.update(name, id, patch);
      setData((prev) => ({
        ...prev,
        [name]: (prev[name] as Array<{ id: string }>).map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        ),
      }));
    },
    [repo],
  );

  const remove = useCallback<DataContextValue["remove"]>(
    async (name, id) => {
      await repo.remove(name, id);
      setData((prev) => ({
        ...prev,
        [name]: (prev[name] as Array<{ id: string }>).filter((r) => r.id !== id),
      }));
    },
    [repo],
  );

  const reset = useCallback(async () => {
    if (repo.reset) {
      const fresh = await repo.reset();
      setData(fresh);
    } else {
      await refresh();
    }
  }, [repo, refresh]);

  const accountIndex = useMemo(
    () => new Map(data.accounts.map((a) => [a.id, a])),
    [data.accounts],
  );
  const categoryIndex = useMemo(
    () => new Map(data.categories.map((c) => [c.id, c])),
    [data.categories],
  );
  const categoryCodeIndex = useMemo(
    () => new Map(data.categories.map((c) => [c.code, c])),
    [data.categories],
  );
  const workStreamIndex = useMemo(
    () => new Map(data.workStreams.map((w) => [w.id, w])),
    [data.workStreams],
  );

  const value: DataContextValue = {
    backend: repo.backend,
    loading,
    error,
    data,
    refresh,
    reset,
    insert,
    update,
    remove,
    accountById: (id) => (id ? accountIndex.get(id) : undefined),
    categoryById: (id) => (id ? categoryIndex.get(id) : undefined),
    categoryByCode: (code) => (code ? categoryCodeIndex.get(code) : undefined),
    workStreamById: (id) => (id ? workStreamIndex.get(id) : undefined),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within a DataProvider");
  return ctx;
}
