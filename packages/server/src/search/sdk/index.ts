import logger from "../../core/logging";
import { BaseSearchStrategy, type SearchResult } from "../base";
import { getSearchConfig } from "../config";
import { extractQueryTerms } from "./extract";
import { filterResults, type FilterOptions } from "./filter";
import { retrieveFromCache, storeToCache } from "./retrieve";
import { SearchState } from "./state";

export interface SearchOptions {
  limit?: number;
  strategies?: string[];
  filter?: FilterOptions;
  useCache?: boolean;
}

export class SearchSDK {
  private strategies: BaseSearchStrategy[] = [];
  private state = new SearchState();

  constructor(strategies?: BaseSearchStrategy[]) {
    if (strategies) {
      for (const s of strategies) this.addStrategy(s);
    }
  }

  addStrategy(strategy: BaseSearchStrategy): void {
    this.strategies.push(strategy);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const config = getSearchConfig();
    const limit = options?.limit ?? config.maxResults;
    const useCache = options?.useCache ?? true;

    if (useCache) {
      const cached = retrieveFromCache(query, config.cacheTtl);
      if (cached) return filterResults(cached, { ...options?.filter, maxResults: limit });
    }

    const terms = extractQueryTerms(query);
    if (terms.length === 0) return [];

    const candidates = this.selectStrategies(options?.strategies);
    if (candidates.length === 0) return [];

    const allResults: SearchResult[] = [];

    const settled = await Promise.allSettled(
      candidates.map((s) =>
        Promise.race([
          s.search(query, limit * 2),
          new Promise<SearchResult[]>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), config.timeout),
          ),
        ]),
      ),
    );

    for (const result of settled) {
      if (result.status === "fulfilled") {
        allResults.push(...result.value);
      } else {
        logger.warn({ err: result.reason }, "Search strategy failed");
      }
    }

    const filtered = filterResults(allResults, { ...options?.filter, maxResults: limit });
    this.state.addQuery(query, filtered);

    if (useCache) {
      storeToCache(query, filtered, config.cacheTtl);
    }

    return filtered;
  }

  private selectStrategies(names?: string[]): BaseSearchStrategy[] {
    if (!names || names.length === 0) return this.strategies;
    const nameSet = new Set(names);
    return this.strategies.filter((s) => nameSet.has(s.name));
  }
}
