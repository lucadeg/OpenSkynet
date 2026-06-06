// import { computeEmbedding, cosineSimilarity } from "../../vector/embeddings"; // Commented out - module removed
import type { HyMemoryRecord } from "./models";
import type { MemoryType } from "../../../core/types";
import type { HyMemoryStore } from "./store";

export class Retriever {
  private store: HyMemoryStore;

  constructor(store: HyMemoryStore) {
    this.store = store;
  }

  retrieve(
    query: string,
    limit = 10,
  ): Array<HyMemoryRecord & { score: number }> {
    // TODO: Re-implement when vector embeddings are available
    // For now, return empty results as semantic search can't work without embeddings
    return [];
    /*
    const queryEmbedding = computeEmbedding(query);
    const results = this.store.search(queryEmbedding, limit * 2);

    const queryTokens = new Set(
      query
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );

    const boosted = results.map((r) => {
      let score = r.score;
      const contentTokens = new Set(
        r.content
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2),
      );
      let keywordMatch = 0;
      for (const t of queryTokens) {
        if (contentTokens.has(t)) keywordMatch++;
      }
      score += (keywordMatch / Math.max(queryTokens.size, 1)) * 0.3;
      return { ...r, score };
    });

    boosted.sort((a, b) => b.score - a.score);
    return boosted.slice(0, limit);
    */
  }

  retrieveByType(type: MemoryType, limit = 20): HyMemoryRecord[] {
    return this.store
      .getAll()
      .filter((r) => r.type === type)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  retrieveRecent(limit = 10): HyMemoryRecord[] {
    return this.store
      .getAll()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}
