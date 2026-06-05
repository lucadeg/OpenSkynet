import { test, describe, expect } from "bun:test";
import { ThinkTagParser } from "../../../src/agent/streaming/think-tag-parser";

describe("ThinkTagParser", () => {
  test("parse extracts thinking from think tags", () => {
    const parser = new ThinkTagParser();
    const result = parser.parse("<think reasoning=\"deep\">I need to consider X</think The answer is 42");
    expect(result.thinking).toBe("I need to consider X");
  });

  test("parse returns content without thinking", () => {
    const parser = new ThinkTagParser();
    const result = parser.parse("<think hmm</think The answer is 42");
    expect(result.content).toBe("The answer is 42");
  });

  test("parse returns empty thinking when no tags present", () => {
    const parser = new ThinkTagParser();
    const result = parser.parse("Just plain content here");
    expect(result.thinking).toBe("");
    expect(result.content).toBe("Just plain content here");
  });

  test("stripThinkTags removes all think tags", () => {
    const parser = new ThinkTagParser();
    expect(parser.stripThinkTags("<think abc</think hello")).toBe("hello");
    expect(parser.stripThinkTags("<think data=\"x\">abc</think hello")).toBe("hello");
  });

  test("handles multiline content", () => {
    const parser = new ThinkTagParser();
    const input = "<think\nline1\nline2\n</think\nreal content";
    const result = parser.parse(input);
    expect(result.thinking).toBe("line1\nline2");
    expect(result.content).toBe("real content");
  });

  test("handles nested-style attributes on think tag", () => {
    const parser = new ThinkTagParser();
    const input = "<think type=\"reasoning\" depth=\"3\">deep thought</think final answer";
    const result = parser.parse(input);
    expect(result.thinking).toBe("deep thought");
    expect(result.content).toBe("final answer");
  });

  test("stripThinkTags handles multiple think blocks", () => {
    const parser = new ThinkTagParser();
    const input = "<think a</think middle <think b</think end";
    expect(parser.stripThinkTags(input)).toBe("middle  end");
  });
});
