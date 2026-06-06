// import { cosineSimilarity } from "../../vector/embeddings"; // Commented out - module removed
import type { HyMemoryRecord } from "./models";

const DUPLICATE_THRESHOLD = 0.85;

export class Merger {
  findDuplicates(records: HyMemoryRecord[]): Array<[string, string]> {
    // TODO: Re-implement when vector embeddings are available
    // For now, return empty array as duplicates can't be computed without embeddings
    return [];
    /*
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) {
        const sim = cosineSimilarity(records[i].embedding, records[j].embedding);
        if (sim >= DUPLICATE_THRESHOLD) {
          pairs.push([records[i].id, records[j].id]);
        }
      }
    }
    return pairs;
    */
  }

  merge(duplicates: Array<[HyMemoryRecord, HyMemoryRecord]>): HyMemoryRecord[] {
    return duplicates.map(([a, b]) => {
      const primary = a.importance >= b.importance ? a : b;
      const secondary = a.importance >= b.importance ? b : a;

      const connections = new Set([...primary.connections, secondary.id]);
      if (primary.content.length < secondary.content.length) {
        return {
          ...secondary,
          id: primary.id,
          importance: Math.max(primary.importance, secondary.importance),
          connections: Array.from(connections),
          accessCount: primary.accessCount + secondary.accessCount,
        };
      }

      return {
        ...primary,
        importance: Math.max(primary.importance, secondary.importance),
        connections: Array.from(connections),
        accessCount: primary.accessCount + secondary.accessCount,
      };
    });
  }
}
