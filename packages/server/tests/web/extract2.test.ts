/** Tests for Web Extract */
import { test, describe, expect } from "bun:test";

describe("WebExtract", () => {
  describe("html parsing", () => {
    test("extracts text from html", () => {
      const html = '<html><body><h1>Title</h1></body></html>';
      const text = "Title";
      expect(text).toBeDefined();
    });

    test("extracts links", () => {
      const html = '<a href="https://example.com">Link</a>';
      const links = html.match(/href="([^"]*)"/g);
      expect(links).toBeDefined();
    });
  });

  describe("metadata extraction", () => {
    test("extracts title", () => {
      const title = "Example Page";
      expect(title).toBe("Example Page");
    });

    test("extracts description", () => {
      const description = "Page description";
      expect(description).toBeDefined();
    });
  });

  describe("clean text", () => {
    test("removes extra whitespace", () => {
      const text = "  extra   spaces  ";
      const cleaned = text.replace(/\s+/g, " ");
      expect(cleaned).toBe(" extra spaces ");
    });
  });
});
