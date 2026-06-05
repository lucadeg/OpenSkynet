import { extractQueryTerms } from "./extract";

const _cache = new Map<string, { results: import("../base").SearchResult[]; expires: number }>();

export function retrieveFromCache(
  query: string,
  ttlSeconds = 300,
): import("../base").SearchResult[] | null {
  const terms = extractQueryTerms(query);
  const key = terms.sort().join(" ");
  const entry = _cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expires) {
    _cache.delete(key);
    return null;
  }

  return entry.results;
}

export function storeToCache(
  query: string,
  results: import("../base").SearchResult[],
  ttlSeconds = 300,
): void {
  const terms = extractQueryTerms(query);
  const key = terms.sort().join(" ");
  _cache.set(key, { results, expires: Date.now() + ttlSeconds * 1000 });
}

export function clearQueryCache(): void {
  _cache.clear();
}
