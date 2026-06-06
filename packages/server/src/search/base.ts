export interface SearchResult {
  title: string;
  url?: string;
  snippet: string;
  score: number;
  source: string;
}

export abstract class BaseSearchStrategy {
  abstract search(query: string, limit?: number): Promise<SearchResult[]>;
  abstract get name(): string;
}
