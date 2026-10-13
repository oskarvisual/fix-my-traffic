/**
 * Minimal async key-value abstraction so storage can be swapped (IndexedDB in
 * the browser, in-memory in tests).
 */
import { createStore, del, get, set, type UseStore } from 'idb-keyval';

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export class IndexedDbStore implements KeyValueStore {
  private readonly store: UseStore;

  constructor(dbName: string, storeName = 'kv') {
    this.store = createStore(dbName, storeName);
  }

  get<T>(key: string): Promise<T | undefined> {
    return get<T>(key, this.store);
  }

  set<T>(key: string, value: T): Promise<void> {
    return set(key, value, this.store);
  }

  delete(key: string): Promise<void> {
    return del(key, this.store);
  }
}

export class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    const v = this.data.get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
