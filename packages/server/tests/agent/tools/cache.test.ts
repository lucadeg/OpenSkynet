import { test, describe, expect, beforeEach } from "bun:test";
import { MemoryCache, NoOpCache } from "../../../src/agent/tools/cache";

describe("MemoryCache", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
  });

  test("get returns null for missing key", () => {
    expect(cache.get("missing")).toBeNull();
  });

  test("set and get round-trip works", () => {
    const result = { success: true, output: "hello" };
    cache.set("key1", result);
    expect(cache.get("key1")).toEqual(result);
  });

  test("expired entries return null", () => {
    cache.set("key1", { success: true, output: "data" }, -1);
    expect(cache.get("key1")).toBeNull();
  });

  test("entries with positive TTL are returned", () => {
    cache.set("key1", { success: true, output: "data" }, 60_000);
    expect(cache.get("key1")).not.toBeNull();
  });

  test("clear removes all entries", () => {
    cache.set("a", { success: true, output: "1" });
    cache.set("b", { success: true, output: "2" });
    cache.clear();
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
  });

  test("different keys store different values", () => {
    cache.set("a", { success: true, output: "val-a" });
    cache.set("b", { success: true, output: "val-b" });
    expect(cache.get("a")!.output).toBe("val-a");
    expect(cache.get("b")!.output).toBe("val-b");
  });
});

describe("NoOpCache", () => {
  test("get always returns null", () => {
    const cache = new NoOpCache();
    expect(cache.get("anything")).toBeNull();
  });

  test("set does not throw", () => {
    const cache = new NoOpCache();
    expect(() => cache.set("key", { success: true, output: "" })).not.toThrow();
  });

  test("clear does not throw", () => {
    const cache = new NoOpCache();
    expect(() => cache.clear()).not.toThrow();
  });
});
