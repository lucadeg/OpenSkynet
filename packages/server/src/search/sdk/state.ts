import type { SearchResult } from "../base";

export class SearchState {
  private queries: string[] = [];
  private allResults: Map<string, SearchResult[]> = new Map();
  createdAt: number = Date.now();

  addQuery(query: string, results: SearchResult[]): void {
    this.queries.push(query);
    this.allResults.set(query, results);
  }

  getResults(query: string): SearchResult[] | undefined {
    return this.allResults.get(query);
  }

  get allQueries(): string[] {
    return [...this.queries];
  }

  get flattened(): SearchResult[] {
    const seen = new Set<string>();
    const out: SearchResult[] = [];
    for (const results of this.allResults.values()) {
      for (const r of results) {
        const key = `${r.source}:${r.title}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(r);
        }
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }

  get queryCount(): number {
    return this.queries.length;
  }

  get resultCount(): number {
    let count = 0;
    for (const results of this.allResults.values()) {
      count += results.length;
    }
    return count;
  }

  reset(): void {
    this.queries = [];
    this.allResults.clear();
    this.createdAt = Date.now();
  }
}
