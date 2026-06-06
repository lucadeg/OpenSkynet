import { getConfig } from "../core/config";

export interface SearchConfig {
  maxResults: number;
  timeout: number;
  cacheTtl: number;
}

let _searchConfig: SearchConfig | null = null;

export function getSearchConfig(): SearchConfig {
  if (_searchConfig) return _searchConfig;

  const config = getConfig();
  _searchConfig = Object.freeze({
    maxResults: parseInt(process.env.SEDIMAN_SEARCH_MAX_RESULTS ?? "10", 10),
    timeout: config.defaultHttpTimeout * 1000,
    cacheTtl: parseInt(process.env.SEDIMAN_SEARCH_CACHE_TTL ?? "300", 10),
  });

  return _searchConfig;
}
