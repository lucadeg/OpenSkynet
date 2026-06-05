import type { SearchResult } from "../base";

interface CacheEntry {
  results: SearchResult[];
  expires: number;
}

export class SearchCache {
  private store = new Map<string, CacheEntry>();
  private maxEntries: number;
  private defaultTtl: number;

  constructor(maxEntries = 100, defaultTtl = 300) {
    this.maxEntries = maxEntries;
    this.defaultTtl = defaultTtl;
  }

  get(key: string): SearchResult[] | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }

    return entry.results;
  }

  set(key: string, results: SearchResult[], ttl?: number): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }

    this.store.set(key, {
      results,
      expires: Date.now() + (ttl ?? this.defaultTtl) * 1000,
    });
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
