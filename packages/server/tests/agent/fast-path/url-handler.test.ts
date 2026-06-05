import { test, describe, expect } from "bun:test";
import { UrlHandler } from "../../../src/agent/fast-path/url-handler";

describe("UrlHandler", () => {
  test("extractUrl returns URL from task text that is only a URL", () => {
    const handler = new UrlHandler();
    expect(handler.extractUrl("https://example.com")).toBe("https://example.com");
    expect(handler.extractUrl("http://google.com")).toBe("http://google.com");
    expect(handler.extractUrl("  https://example.com  ")).toBe("https://example.com");
  });

  test("extractUrl returns URL embedded in text", () => {
    const handler = new UrlHandler();
    const result = handler.extractUrl("Go to https://example.com/page?q=1 now");
    expect(result).toBe("https://example.com/page?q=1");
  });

  test("extractUrl returns null for non-URL tasks", () => {
    const handler = new UrlHandler();
    expect(handler.extractUrl("What is the weather?")).toBeNull();
    expect(handler.extractUrl("just some text")).toBeNull();
    expect(handler.extractUrl("")).toBeNull();
  });

  test("extractUrl handles various URL formats", () => {
    const handler = new UrlHandler();
    expect(handler.extractUrl("https://example.com/path/to/page")).toBe("https://example.com/path/to/page");
    expect(handler.extractUrl("http://localhost:3000/api")).toBe("http://localhost:3000/api");
    expect(handler.extractUrl("https://site.com/page?foo=bar&baz=1")).toBe("https://site.com/page?foo=bar&baz=1");
  });
});
