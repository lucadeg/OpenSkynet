import type { HyMemoryRecord } from "./models";
import type { HyMemoryStore } from "./store";
import type { Evolver } from "./evolver";
import type { Merger } from "./merger";

export class ConsolidationWorker {
  private store: HyMemoryStore;
  private evolver: Evolver;
  private merger: Merger;

  constructor(store: HyMemoryStore, evolver: Evolver, merger: Merger) {
    this.store = store;
    this.evolver = evolver;
    this.merger = merger;
  }

  async run(): Promise<{ merged: number; evolved: number; pruned: number }> {
    const allRecords = this.store.getAll();

    const duplicatePairs = this.merger.findDuplicates(allRecords);
    const idToRecord = new Map(allRecords.map((r) => [r.id, r]));
    const dupePairs: Array<[HyMemoryRecord, HyMemoryRecord]> = [];
    for (const [idA, idB] of duplicatePairs) {
      const a = idToRecord.get(idA);
      const b = idToRecord.get(idB);
      if (a && b) dupePairs.push([a, b]);
    }

    const mergedRecords = this.merger.merge(dupePairs);
    let mergedCount = 0;
    for (const merged of mergedRecords) {
      this.store.add(merged);
      const secondaryId = dupePairs[mergedCount]?.[1]?.id;
      if (secondaryId && secondaryId !== merged.id) {
        this.store.remove(secondaryId);
      }
      mergedCount++;
    }

    const currentRecords = this.store.getAll();
    const evolution = this.evolver.evolve(currentRecords);

    let evolvedCount = 0;
    for (const update of evolution.updated) {
      this.store.update(update.id, update.changes);
      evolvedCount++;
    }

    let prunedCount = 0;
    for (const id of evolution.removed) {
      if (this.store.remove(id)) prunedCount++;
    }

    return { merged: mergedCount, evolved: evolvedCount, pruned: prunedCount };
  }
}
