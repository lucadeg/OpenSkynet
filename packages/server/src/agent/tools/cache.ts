import type { ToolResult } from "./interfaces.js";

export class MemoryCache {
  private cache = new Map<string, { result: ToolResult; expiry: number }>();

  get(key: string): ToolResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }

  set(key: string, result: ToolResult, ttlMs = 60_000): void {
    this.cache.set(key, { result, expiry: Date.now() + ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}

export class NoOpCache {
  get(_key: string): ToolResult | null {
    return null;
  }

  set(_key: string, _result: ToolResult, _ttlMs?: number): void {}

  clear(): void {}
}
