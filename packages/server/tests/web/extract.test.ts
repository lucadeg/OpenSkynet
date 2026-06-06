import { test, describe, expect, mock, beforeEach, afterEach } from "bun:test";
import { clearUrlCache, httpExtract } from "../../src/web/extract";

describe("web extract", () => {
  afterEach(() => {
    clearUrlCache();
  });

  test("clearUrlCache clears cache", () => {
    expect(() => clearUrlCache()).not.toThrow();
  });

  test("httpExtract returns title and content for valid HTML", async () => {
    const html = `<!DOCTYPE html><html><head><title>Test Page</title></head><body><p>Hello world content here.</p></body></html>`;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () =>
      new Response(html, { status: 200, headers: { "Content-Type": "text/html" } })
    );

    try {
      const result = await httpExtract("https://example.com/test");
      expect(result.title).toBe("Test Page");
      expect(result.content).toContain("Hello world");
      expect(result.url).toBe("https://example.com/test");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("httpExtract throws on HTTP error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () =>
      new Response("Not Found", { status: 404, statusText: "Not Found" })
    );

    try {
      expect(httpExtract("https://example.com/missing")).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("httpExtract uses cache on second call", async () => {
    const html = `<!DOCTYPE html><html><head><title>Cached</title></head><body><p>Cached content.</p></body></html>`;
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = mock(async () => {
      callCount++;
      return new Response(html, { status: 200 });
    });

    try {
      await httpExtract("https://example.com/cached");
      await httpExtract("https://example.com/cached");
      expect(callCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
