import logger from "../../core/logging";
import { BaseSearchStrategy, type SearchResult } from "../base";

export class WebSearchStrategy extends BaseSearchStrategy {
  get name(): string {
    return "web";
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    logger.info({ query, limit }, "Web search not yet implemented");
    return [];
  }
}
