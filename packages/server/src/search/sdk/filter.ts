import type { SearchResult } from "../base";

export interface FilterOptions {
  minScore?: number;
  maxResults?: number;
  deduplicate?: boolean;
  sources?: string[];
}

export function filterResults(
  results: SearchResult[],
  options?: FilterOptions,
): SearchResult[] {
  let filtered = [...results];

  if (options?.sources?.length) {
    const allowed = new Set(options.sources);
    filtered = filtered.filter((r) => allowed.has(r.source));
  }

  if (options?.minScore !== undefined) {
    filtered = filtered.filter((r) => r.score >= options.minScore!);
  }

  if (options?.deduplicate !== false) {
    const seen = new Set<string>();
    filtered = filtered.filter((r) => {
      const key = `${r.source}:${r.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  filtered.sort((a, b) => b.score - a.score);

  if (options?.maxResults !== undefined) {
    filtered = filtered.slice(0, options.maxResults);
  }

  return filtered;
}
