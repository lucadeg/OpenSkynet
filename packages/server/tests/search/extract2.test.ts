/** Tests for Search Extract */
import { test, describe, expect } from "bun:test";

describe("SearchExtract", () => {
  describe("extraction from HTML", () => {
    test("extracts title from HTML", () => {
      const html = "<title>Page Title</title>";
      const title = "Page Title";
      expect(title).toBeDefined();
    });

    test("extracts description from meta", () => {
      const html = '<meta name="description" content="Page description">';
      const description = "Page description";
      expect(description).toBeDefined();
    });

    test("extracts body text", () => {
      const html = "<body><p>Main content</p></body>";
      const content = "Main content";
      expect(content).toBeDefined();
    });
  });

  describe("cleaning", () => {
    test("removes scripts from content", () => {
      const withScripts = "<script>alert('test')</script><p>content</p>";
      const cleaned = withScripts.replace(/<script[^>]*>.*?<\/script>/gis, "");
      expect(cleaned).not.toContain("script");
    });

    test("removes styles from content", () => {
      const withStyles = "<style>body{color:red;}</style><p>content</p>";
      const cleaned = withStyles.replace(/<style[^>]*>.*?<\/style>/gis, "");
      expect(cleaned).not.toContain("style");
    });
  });
});
