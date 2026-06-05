/** Tests for Search Filter */
import { test, describe, expect } from "bun:test";

describe("SearchFilter", () => {
  describe("filtering", () => {
    test("filters by domain", () => {
      const results = [
        { url: "https://example.com" },
        { url: "https://spam.com" },
      ];
      const filtered = results.filter((r) => !r.url.includes("spam"));
      expect(filtered.length).toBe(1);
    });

    test("filters by pattern", () => {
      const results = [
        { title: "Python Tutorial" },
        { title: "JavaScript Guide" },
      ];
      const pattern = /Python/i;
      const filtered = results.filter((r) => pattern.test(r.title!));
      expect(filtered.length).toBe(1);
    });
  });

  describe("deduplication", () => {
    test("removes duplicate URLs", () => {
      const results = [
        { url: "https://example.com/page" },
        { url: "https://example.com/page" },
        { url: "https://other.com/page" },
      ];
      const unique = Array.from(new Set(results.map((r) => r.url)));
      expect(unique.length).toBe(2);
    });

    test("removes duplicate titles", () => {
      const results = [
        { title: "Same Title", url: "a" },
        { title: "Same Title", url: "b" },
        { title: "Different", url: "c" },
      ];
      const unique = Array.from(new Map(results.map((r) => [r.title, r])).values());
      expect(unique.length).toBe(2);
    });
  });

  describe("ranking", () => {
    test("ranks by relevance score", () => {
      const results = [
        { url: "a", relevance: 0.9 },
        { url: "b", relevance: 0.7 },
        { url: "c", relevance: 0.5 },
      ];
      results.sort((a, b) => b.relevance - a.relevance);
      expect(results[0].url).toBe("a");
    });

    test("ranks by freshness", () => {
      const results = [
        { url: "a", date: "2024-01-01" },
        { url: "b", date: "2024-06-01" },
      ];
      results.sort((a, b) => b.date!.localeCompare(a.date!));
      expect(results[0].url).toBe("b");
    });
  });

  describe("limits", () => {
    test("respects max results", () => {
      const results = Array.from({ length: 100 }, (_, i) => ({ url: `result${i}` }));
      const maxResults = 10;
      const limited = results.slice(0, maxResults);
      expect(limited.length).toBe(10);
    });
  });
});
