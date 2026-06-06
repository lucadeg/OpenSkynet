import type { HyMemoryRecord } from "./models";

const DECAY_FACTOR = 0.95;
const MIN_IMPORTANCE = 0.1;
const PRUNE_THRESHOLD = 0.05;

export class Evolver {
  evolve(
    records: HyMemoryRecord[],
  ): {
    added: HyMemoryRecord[];
    removed: string[];
    updated: Array<{ id: string; changes: Partial<HyMemoryRecord> }>;
  } {
    const now = new Date().toISOString();
    const removed: string[] = [];
    const updated: Array<{ id: string; changes: Partial<HyMemoryRecord> }> = [];

    for (const record of records) {
      const ageMs = Date.now() - new Date(record.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const decayedImportance =
        record.importance * Math.pow(DECAY_FACTOR, ageDays);

      const boostedImportance =
        record.accessCount > 0
          ? decayedImportance + Math.log(record.accessCount + 1) * 0.05
          : decayedImportance;

      const finalImportance = Math.max(MIN_IMPORTANCE, Math.min(1.0, boostedImportance));

      if (finalImportance < PRUNE_THRESHOLD) {
        removed.push(record.id);
        continue;
      }

      if (Math.abs(finalImportance - record.importance) > 0.01) {
        updated.push({
          id: record.id,
          changes: { importance: finalImportance },
        });
      }
    }

    return { added: [], removed, updated };
  }
}
