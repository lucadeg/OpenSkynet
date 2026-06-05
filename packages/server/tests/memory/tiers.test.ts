/**
 * Tests for Memory Tiers System.
 * Converted from Python tests/test_memory_tiers.py
 */

import { test, describe, expect, beforeEach } from "bun:test";
import {
  MemoryTier,
  Channel,
  TieredMemoryEntry,
  WorkingMemory,
  SessionMemory,
  LongTermMemory,
} from "../../src/memory/utils/tiers";

describe("MemoryTier", () => {
  test("has correct enum values", () => {
    expect(MemoryTier.WORKING).toBe("working");
    expect(MemoryTier.SESSION).toBe("session");
    expect(MemoryTier.LONG_TERM).toBe("long_term");
  });
});

describe("Channel", () => {
  test("has correct enum values", () => {
    expect(Channel.DECLARATIVE).toBe("declarative");
    expect(Channel.PROCEDURAL).toBe("procedural");
  });
});

describe("TieredMemoryEntry", () => {
  describe("constructor", () => {
    test("creates entry with defaults", () => {
      const entry = new TieredMemoryEntry({
        content: "test content",
      });

      expect(entry.content).toBe("test content");
      expect(entry.tier).toBe(MemoryTier.WORKING);
      expect(entry.channel).toBe(Channel.DECLARATIVE);
      expect(entry.importance).toBe(0.5);
      expect(entry.accessCount).toBe(0);
      expect(entry.entryId).toBeDefined();
    });

    test("creates entry with custom values", () => {
      const entry = new TieredMemoryEntry({
        content: "important",
        tier: MemoryTier.LONG_TERM,
        channel: Channel.PROCEDURAL,
        importance: 0.9,
        timestamp: 1000000,
        accessCount: 5,
      });

      expect(entry.tier).toBe(MemoryTier.LONG_TERM);
      expect(entry.channel).toBe(Channel.PROCEDURAL);
      expect(entry.importance).toBe(0.9);
      expect(entry.accessCount).toBe(5);
    });

    test("generates unique entry IDs", () => {
      const entry1 = new TieredMemoryEntry({ content: "test1" });
      const entry2 = new TieredMemoryEntry({ content: "test2" });

      expect(entry1.entryId).not.toBe(entry2.entryId);
    });
  });

  describe("recencyScore", () => {
    test("returns 1.0 for recent entries", () => {
      const entry = new TieredMemoryEntry({
        content: "recent",
        timestamp: Date.now(),
      });

      expect(entry.recencyScore()).toBe(1.0);
    });

    test("returns lower score for old entries", () => {
      const oldTimestamp = Date.now() - 1000 * 60 * 60 * 24 * 30; // 30 days ago
      const entry = new TieredMemoryEntry({
        content: "old",
        timestamp: oldTimestamp,
      });

      expect(entry.recencyScore()).toBeLessThan(0.5);
    });

    test("returns 0.5 for no timestamp", () => {
      const entry = new TieredMemoryEntry({
        content: "test",
        timestamp: 0,
      });

      expect(entry.recencyScore()).toBe(0.5);
    });
  });

  describe("combinedScore", () => {
    test("considers importance, recency, and access", () => {
      const entry = new TieredMemoryEntry({
        content: "test",
        importance: 0.8,
        timestamp: Date.now(),
        accessCount: 10,
      });

      const score = entry.combinedScore();
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    test("weights importance highest", () => {
      const importantEntry = new TieredMemoryEntry({
        content: "important",
        importance: 1.0,
        timestamp: 0,
        accessCount: 0,
      });

      const unimportantEntry = new TieredMemoryEntry({
        content: "unimportant",
        importance: 0.1,
        timestamp: Date.now(),
        accessCount: 10,
      });

      expect(importantEntry.combinedScore()).toBeGreaterThan(unimportantEntry.combinedScore());
    });
  });

  describe("access", () => {
    test("increments access count", () => {
      const entry = new TieredMemoryEntry({ content: "test" });

      entry.access();
      entry.access();

      expect(entry.accessCount).toBe(2);
    });

    test("updates last accessed time", () => {
      const entry = new TieredMemoryEntry({
        content: "test",
        timestamp: 1000000,
      });

      const before = entry.lastAccessed;
      entry.access();
      const after = entry.lastAccessed;

      expect(after).toBeGreaterThan(before);
    });
  });

  describe("promote", () => {
    test("updates tier", () => {
      const entry = new TieredMemoryEntry({
        content: "test",
        tier: MemoryTier.WORKING,
      });

      entry.promote(MemoryTier.SESSION);
      expect(entry.tier).toBe(MemoryTier.SESSION);
    });

    test("updates timestamp", () => {
      const entry = new TieredMemoryEntry({
        content: "test",
        timestamp: 1000000,
      });

      entry.promote(MemoryTier.LONG_TERM);
      expect(entry.timestamp).toBeGreaterThan(1000000);
    });
  });

  describe("toJSON and fromJSON", () => {
    test("serializes and deserializes correctly", () => {
      const original = new TieredMemoryEntry({
        content: "test",
        tier: MemoryTier.SESSION,
        importance: 0.7,
        metadata: { key: "value" },
      });

      const json = original.toJSON();
      const restored = TieredMemoryEntry.fromJSON(json);

      expect(restored.content).toBe(original.content);
      expect(restored.tier).toBe(original.tier);
      expect(restored.importance).toBe(original.importance);
      expect(restored.metadata).toEqual(original.metadata);
      expect(restored.entryId).toBe(original.entryId);
    });
  });
});

describe("WorkingMemory", () => {
  let memory: WorkingMemory;

  beforeEach(() => {
    memory = new WorkingMemory({ maxEntries: 5, maxChars: 1000 });
  });

  describe("add", () => {
    test("adds entry to memory", () => {
      const entry = memory.add({ content: "test" });

      expect(memory.size).toBe(1);
      expect(entry.content).toBe("test");
      expect(entry.tier).toBe(MemoryTier.WORKING);
    });

    test("trims by entry count when over limit", () => {
      for (let i = 0; i < 10; i++) {
        memory.add({ content: `entry ${i}` });
      }

      expect(memory.size).toBe(5);
    });

    test("trims by character count when over limit", () => {
      memory = new WorkingMemory({ maxEntries: 100, maxChars: 100 });

      memory.add({ content: "a".repeat(50) });
      memory.add({ content: "b".repeat(50) });

      // Should trim to fit within maxChars
      expect(memory.chars).toBeLessThanOrEqual(100);
    });

    test("removes lowest scored entries first", () => {
      memory.add({ content: "unimportant", importance: 0.1 });
      memory.add({ content: "very important", importance: 1.0 });

      for (let i = 0; i < 10; i++) {
        memory.add({ content: `filler ${i}`, importance: 0.3 });
      }

      // Unimportant entry should be removed
      const entries = memory.getAll();
      expect(entries.some((e) => e.content === "unimportant")).toBe(false);
    });
  });

  describe("get", () => {
    test("retrieves entry by ID", () => {
      const added = memory.add({ content: "test" });
      const retrieved = memory.get(added.entryId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe("test");
    });

    test("increments access count on retrieval", () => {
      const added = memory.add({ content: "test" });
      memory.get(added.entryId);

      expect(added.accessCount).toBe(1);
    });

    test("returns undefined for non-existent entry", () => {
      const retrieved = memory.get("non-existent");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("remove", () => {
    test("removes entry by ID", () => {
      const added = memory.add({ content: "test" });
      const removed = memory.remove(added.entryId);

      expect(removed).toBe(true);
      expect(memory.size).toBe(0);
    });

    test("returns false for non-existent entry", () => {
      const removed = memory.remove("non-existent");
      expect(removed).toBe(false);
    });
  });

  describe("clear", () => {
    test("removes all entries", () => {
      memory.add({ content: "test1" });
      memory.add({ content: "test2" });

      memory.clear();

      expect(memory.size).toBe(0);
      expect(memory.chars).toBe(0);
    });
  });

  describe("promoteToSession", () => {
    test("promotes entry to session memory", () => {
      const sessionMemory = new SessionMemory();
      const added = memory.add({ content: "test" });

      const promoted = memory.promoteToSession(added.entryId, sessionMemory);

      expect(promoted).toBe(true);
      expect(memory.size).toBe(0);
      expect(sessionMemory.size).toBe(1);
    });

    test("returns false for non-existent entry", () => {
      const sessionMemory = new SessionMemory();
      const promoted = memory.promoteToSession("non-existent", sessionMemory);

      expect(promoted).toBe(false);
    });
  });

  describe("export and import", () => {
    test("exports entries as JSON", () => {
      memory.add({ content: "test1" });
      memory.add({ content: "test2" });

      const exported = memory.export();

      expect(exported).toBeDefined();
      expect(exported.length).toBe(2);
    });

    test("imports entries from JSON", () => {
      const entries = [
        {
          content: "imported1",
          tier: MemoryTier.WORKING,
          channel: Channel.DECLARATIVE,
          importance: 0.5,
          timestamp: Date.now(),
          accessCount: 0,
          lastAccessed: Date.now(),
          metadata: {},
          entryId: "test-id",
        },
      ];

      memory.import(entries);

      expect(memory.size).toBe(1);
    });
  });
});

describe("SessionMemory", () => {
  let memory: SessionMemory;

  beforeEach(() => {
    memory = new SessionMemory({ maxEntries: 10, maxChars: 5000 });
  });

  describe("add", () => {
    test("adds entry with session tier", () => {
      const entry = memory.add({ content: "test" });

      expect(entry.tier).toBe(MemoryTier.SESSION);
      expect(memory.size).toBe(1);
    });

    test("stores entries in map", () => {
      const entry1 = memory.add({ content: "test1" });
      const entry2 = memory.add({ content: "test2" });

      expect(memory.get(entry1.entryId)).toBeDefined();
      expect(memory.get(entry2.entryId)).toBeDefined();
    });
  });

  describe("getAll", () => {
    test("returns entries sorted by score", () => {
      memory.add({ content: "unimportant", importance: 0.1 });
      memory.add({ content: "important", importance: 0.9 });

      const entries = memory.getAll();

      expect(entries.length).toBe(2);
      expect(entries[0].importance).toBeGreaterThan(entries[1].importance);
    });
  });

  describe("promoteToLongTerm", () => {
    test("promotes entry to long term memory", () => {
      const longTermMemory = new LongTermMemory();
      const added = memory.add({ content: "test" });

      const promoted = memory.promoteToLongTerm(added.entryId, longTermMemory);

      expect(promoted).toBe(true);
      expect(memory.size).toBe(0);
      expect(longTermMemory.size).toBe(1);
    });
  });
});

describe("LongTermMemory", () => {
  let memory: LongTermMemory;

  beforeEach(() => {
    memory = new LongTermMemory({ maxEntries: 50, maxChars: 10000 });
  });

  describe("queryByChannel", () => {
    test("filters entries by channel", () => {
      memory.add({ content: "fact", channel: Channel.DECLARATIVE });
      memory.add({ content: "procedure", channel: Channel.PROCEDURAL });

      const declarative = memory.queryByChannel(Channel.DECLARATIVE);
      const procedural = memory.queryByChannel(Channel.PROCEDURAL);

      expect(declarative.length).toBe(1);
      expect(procedural.length).toBe(1);
      expect(declarative[0].content).toBe("fact");
      expect(procedural[0].content).toBe("procedure");
    });
  });

  describe("queryByImportance", () => {
    test("filters entries by importance", () => {
      memory.add({ content: "important", importance: 0.8 });
      memory.add({ content: "unimportant", importance: 0.2 });

      const important = memory.queryByImportance(0.5);

      expect(important.length).toBe(1);
      expect(important[0].importance).toBeGreaterThanOrEqual(0.5);
    });
  });
});
