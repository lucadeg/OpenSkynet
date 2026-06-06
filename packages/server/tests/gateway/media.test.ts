import { test, describe, expect, beforeEach } from "bun:test";
import { MediaCache } from "../../src/gateway/media";

describe("MediaCache", () => {
  let cache: MediaCache;

  beforeEach(() => {
    cache = new MediaCache();
  });

  test("set and get returns stored entry", () => {
    const data = Buffer.from("test-data");
    cache.set("http://example.com/image.png", data, "image/png");
    const result = cache.get("http://example.com/image.png");
    expect(result).not.toBeNull();
    expect(result!.data).toEqual(data);
    expect(result!.mimeType).toBe("image/png");
  });

  test("returns null for missing keys", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  test("expires entries", async () => {
    const data = Buffer.from("expiring");
    cache.set("http://example.com/img.png", data, "image/png", 1);
    await Bun.sleep(10);
    expect(cache.get("http://example.com/img.png")).toBeNull();
  });

  test("clear removes all entries", () => {
    cache.set("a", Buffer.from("1"), "text/plain");
    cache.set("b", Buffer.from("2"), "text/plain");
    cache.clear();
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
  });

  test("overwrites existing entry", () => {
    cache.set("key", Buffer.from("old"), "text/plain");
    cache.set("key", Buffer.from("new"), "text/html");
    const result = cache.get("key");
    expect(result!.data.toString()).toBe("new");
    expect(result!.mimeType).toBe("text/html");
  });
});
