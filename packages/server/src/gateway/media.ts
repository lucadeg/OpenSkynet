export class MediaCache {
  private cache: Map<string, { data: Buffer; mimeType: string; expiry: number }> = new Map();

  set(url: string, data: Buffer, mimeType: string, ttlMs: number = 3600_000): void {
    this.cache.set(url, { data, mimeType, expiry: Date.now() + ttlMs });
  }

  get(url: string): { data: Buffer; mimeType: string } | null {
    const entry = this.cache.get(url);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(url);
      return null;
    }
    return { data: entry.data, mimeType: entry.mimeType };
  }

  clear(): void {
    this.cache.clear();
  }
}
