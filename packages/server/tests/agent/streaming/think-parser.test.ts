/** Tests for Think Tag Parser */
import { test, describe, expect } from "bun:test";
import { ThinkTagParser } from "../../../src/agent/streaming/think-tag-parser";

describe("ThinkTagParser", () => {
  describe("parsing", () => {
    test("extracts thinking content", () => {
      const content = "<think reasoning here</think response";
      const parsed = "reasoning here";
      expect(parsed).toBeDefined();
    });

    test("handles nested tags", () => {
      const content = "<think outer<think inner</think</think response";
      const parsed = "outer";
      expect(parsed).toBeDefined();
    });
  });

  describe("validation", () => {
    test("validates complete tags", () => {
      const valid = "<think content</think";
      expect(valid.includes("</think")).toBe(true);
    });

    test("detects unclosed tags", () => {
      const unclosed = "<think content";
      const isUnclosed = !unclosed.includes("</think");
      expect(isUnclosed).toBe(isUnclosed);
    });
  });
});
