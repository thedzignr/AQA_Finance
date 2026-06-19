import { type CollectionMap, type CollectionName, type Dataset } from "./dataset";
import type { Repository } from "./repository";
import { buildSeedDataset } from "./seed";

const STORAGE_KEY = "aqa_finance_dataset_v1";

/**
 * In-memory + localStorage repository. This is the default backend and lets the
 * entire app run offline against the seeded demo dataset, while using the exact
 * same production-shaped data structures as the Supabase backend.
 */
export class MockRepository implements Repository {
  readonly backend = "mock" as const;
  private data: Dataset;

  constructor() {
    this.data = this.read();
  }

  private read(): Dataset {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          return JSON.parse(raw) as Dataset;
        } catch {
          /* fall through to seed */
        }
      }
    }
    const seeded = buildSeedDataset();
    this.write(seeded);
    return seeded;
  }

  private write(data: Dataset) {
    this.data = data;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }

  private clone(): Dataset {
    return JSON.parse(JSON.stringify(this.data)) as Dataset;
  }

  async loadAll(): Promise<Dataset> {
    // simulate async latency for realism
    await delay(60);
    return this.clone();
  }

  async insert<K extends CollectionName>(name: K, row: CollectionMap[K]) {
    const list = this.data[name] as CollectionMap[K][];
    list.push(row);
    this.write(this.data);
    return row;
  }

  async update<K extends CollectionName>(
    name: K,
    id: string,
    patch: Partial<CollectionMap[K]>,
  ) {
    const list = this.data[name] as unknown as Array<{ id: string }>;
    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch };
      this.write(this.data);
    }
  }

  async remove<K extends CollectionName>(name: K, id: string) {
    const list = this.data[name] as unknown as Array<{ id: string }>;
    const next = list.filter((r) => r.id !== id);
    (this.data[name] as unknown) = next;
    this.write(this.data);
  }

  async reset(): Promise<Dataset> {
    const seeded = buildSeedDataset();
    this.write(seeded);
    return this.clone();
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
