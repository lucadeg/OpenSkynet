/**
 * Memory consolidation — merge or summarize entries to free space.
 *
 * When memory is full and a new entry needs to be added, the consolidator
 * attempts to free space by merging similar entries or summarizing old ones.
 * Uses LLM summarization when available, falls back to heuristic truncation.
 */

import type { LLMProvider } from "../../llm/provider.js";
import { scoreImportance } from "./importance.js";

export interface StoreUsage {
  entries: string[];
  chars: number;
  limit: number;
}

export interface StoreResult {
  success: boolean;
  entry?: string;
  error?: string;
}

export interface ConsolidationResult {
  method: "merge_small" | "summarize_old" | "remove_least_relevant" | "none";
  beforeCount: number;
  afterCount: number;
  freedChars: number;
}

export class MemoryConsolidator {
  private _llm: LLMProvider | null = null;

  constructor(llm?: LLMProvider) {
    this._llm = llm ?? null;
  }

  /**
   * Consolidate memory entries to make space for new content.
   * Returns true if consolidation was successful.
   */
  async consolidateAndAdd(
    store: {
      getUsage: (target: string) => StoreUsage;
      add: (target: string, content: string) => StoreResult;
      get: (target: string) => string;
      set: (target: string, content: string) => void;
      getFile: (target: string) => string;
    },
    target: string,
    newContent: string,
  ): Promise<StoreResult & { consolidation?: ConsolidationResult }> {
    const usage = store.getUsage(target);
    const entries = usage.entries;

    if (!entries || entries.length === 0) {
      return store.add(target, newContent);
    }

    const currentChars = usage.chars;
    const newChars = newContent.length + 1; // +1 for separator
    const spaceNeeded = currentChars + newChars - usage.limit;

    // If there's enough space, just add
    if (spaceNeeded <= 0) {
      return store.add(target, newContent);
    }

    // Try consolidation strategies in order
    const result = await this._tryConsolidation(store, target, entries, spaceNeeded);
    if (result) {
      // After consolidation, try to add again
      return store.add(target, newContent);
    }

    // If all consolidation failed, return error
    return {
      success: false,
      error: "Memory full and unable to consolidate",
    };
  }

  private async _tryConsolidation(
    store: {
      set: (target: string, content: string) => void;
      getFile: (target: string) => string;
    },
    target: string,
    entries: string[],
    spaceNeeded: number,
  ): Promise<ConsolidationResult | null> {
    // Strategy 1: Merge small entries
    const mergedResult = await this._tryMergeSmallEntries(entries, target, spaceNeeded);
    if (mergedResult) {
      store.set(target, mergedResult.content);
      return mergedResult.result;
    }

    // Strategy 2: Summarize old entries (requires LLM)
    if (this._llm) {
      const summarizedResult = await this._trySummarizeOldEntries(entries, target, spaceNeeded);
      if (summarizedResult) {
        store.set(target, summarizedResult.content);
        return summarizedResult.result;
      }
    }

    // Strategy 3: Remove least relevant entries
    const removedResult = await this._tryRemoveLeastRelevant(entries, target, spaceNeeded);
    if (removedResult) {
      store.set(target, removedResult.content);
      return removedResult.result;
    }

    return null;
  }

  private async _tryMergeSmallEntries(
    entries: string[],
    target: string,
    spaceNeeded: number,
  ): Promise<{ content: string; result: ConsolidationResult } | null> {
    // Find entries small enough to merge
    const smallEntries: Array<{ index: number; content: string; chars: number }> = [];
    let totalFreed = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const chars = entry.length;
      if (chars < 100) {
        smallEntries.push({ index: i, content: entry, chars });
        totalFreed += chars + 1; // +1 for separator
        if (totalFreed >= spaceNeeded) break;
      }
    }

    if (smallEntries.length < 2 || totalFreed < spaceNeeded) {
      return null;
    }

    // Merge the small entries
    const mergedContent = smallEntries.map((e) => e.content).join(" | ");

    // Create new entries array with merged entry
    const newEntries = [...entries];
    // Remove small entries (in reverse order to preserve indices)
    for (let i = smallEntries.length - 1; i >= 0; i--) {
      newEntries.splice(smallEntries[i].index, 1);
    }
    // Add merged entry at the beginning
    newEntries.unshift(mergedContent);

    const content = newEntries.join("\n---\n");

    return {
      content,
      result: {
        method: "merge_small",
        beforeCount: entries.length,
        afterCount: newEntries.length,
        freedChars: totalFreed,
      },
    };
  }

  private async _trySummarizeOldEntries(
    entries: string[],
    target: string,
    spaceNeeded: number,
  ): Promise<{ content: string; result: ConsolidationResult } | null> {
    if (!this._llm) return null;

    // Take oldest entries that fit the space needed
    let charsToRemove = 0;
    let removeCount = 0;
    const toSummarize: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      charsToRemove += entry.length + 1; // +1 for separator
      toSummarize.push(entry);
      removeCount++;

      if (charsToRemove >= spaceNeeded && removeCount >= 2) break;
    }

    if (toSummarize.length < 2) return null;

    try {
      // Use LLM to summarize
      const prompt = `Summarize the following memory entries, preserving key information:\n\n${toSummarize.join("\n\n---\n\n")}`;
      const response = await this._llm.chat(
        [{ role: "user", content: prompt }],
        [],
        "Summarize concisely, preserving all important facts, preferences, and context."
      );

      const summary = response.text ?? "Summary unavailable";

      // Create new entries array
      const newEntries = [...entries];
      newEntries.splice(0, removeCount, `[Summary: ${summary}]`);

      const content = newEntries.join("\n---\n");

      return {
        content,
        result: {
          method: "summarize_old",
          beforeCount: entries.length,
          afterCount: newEntries.length,
          freedChars: charsToRemove - summary.length - 1,
        },
      };
    } catch {
      // LLM summarization failed, fall through to next strategy
      return null;
    }
  }

  private async _tryRemoveLeastRelevant(
    entries: string[],
    target: string,
    spaceNeeded: number,
  ): Promise<{ content: string; result: ConsolidationResult } | null> {
    // Score entries by importance
    const scored = entries.map((entry) => ({
      entry,
      score: scoreImportance(entry).score,
    }));

    // Sort by score (lowest first)
    scored.sort((a, b) => a.score - b.score);

    // Remove least relevant entries
    let charsRemoved = 0;
    let removeCount = 0;
    const toRemove: number[] = [];

    for (let i = 0; i < scored.length; i++) {
      charsRemoved += scored[i].entry.length + 1;
      toRemove.push(i);
      removeCount++;

      if (charsRemoved >= spaceNeeded && removeCount >= 1) break;
    }

    if (removeCount === 0) return null;

    // Create new entries array without removed ones
    const newEntries = scored
      .filter((_, idx) => !toRemove.includes(idx))
      .map((s) => s.entry);

    const content = newEntries.join("\n---\n");

    return {
      content,
      result: {
        method: "remove_least_relevant",
        beforeCount: entries.length,
        afterCount: newEntries.length,
        freedChars: charsRemoved,
      },
    };
  }

  setLLM(llm: LLMProvider | null): void {
    this._llm = llm;
  }
}
