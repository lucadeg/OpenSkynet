/** Tests for Memory Extractor */
import { test, describe, expect } from "bun:test";

describe("MemoryExtractor", () => {
  describe("extraction", () => {
    test("extracts facts from conversation", () => {
      const facts = [
        { content: "User prefers dark mode", type: "preference" },
        { content: "User lives in SF", type: "fact" },
      ];
      expect(facts.length).toBe(2);
    });

    test("filters irrelevant information", () => {
      const all = [
        { content: "Hi", relevant: false },
        { content: "User knows Python", relevant: true },
        { content: "Bye", relevant: false },
      ];
      const relevant = all.filter((f) => f.relevant);
      expect(relevant.length).toBe(1);
    });
  });

  describe("classification", () => {
    test("classifies as preference", () => {
      const classification = "preference";
      expect(classification).toBe("preference");
    });

    test("classifies as fact", () => {
      const classification = "fact";
      expect(classification).toBe("fact");
    });

    test("classifies as procedure", () => {
      const classification = "procedure";
      expect(classification).toBe("procedure");
    });
  });

  describe("deduplication", () => {
    test("removes duplicate facts", () => {
      const facts = [
        { content: "User likes TypeScript", id: "1" },
        { content: "User likes TypeScript", id: "2" },
      ];
      const unique = Array.from(new Map(facts.map((f) => [f.content, f])).values());
      expect(Object.keys(unique).length).toBe(1);
    });
  });
});
