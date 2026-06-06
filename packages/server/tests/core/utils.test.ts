import { test, describe, expect } from "bun:test";
import {
  formatConversationContext,
  relativeTime,
  extractJsonFromText,
} from "../../src/core/utils";

describe("formatConversationContext", () => {
  test("formats messages with roles", () => {
    const msgs = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];
    expect(formatConversationContext(msgs)).toBe("User: Hello\nAssistant: Hi there");
  });

  test("respects limit", () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg ${i}`,
    }));
    const result = formatConversationContext(msgs, 5);
    const lines = result.split("\n");
    expect(lines.length).toBe(5);
  });

  test("truncates long content to maxChars", () => {
    const msgs = [{ role: "user", content: "a".repeat(500) }];
    const result = formatConversationContext(msgs, 10, 50);
    expect(result.length).toBeLessThan(100);
  });
});

describe("relativeTime", () => {
  test("returns 'just now' for recent timestamps", () => {
    const now = new Date("2025-01-01T12:00:00Z");
    const ts = "2025-01-01T11:59:30Z";
    expect(relativeTime(ts, now)).toBe("just now");
  });

  test("returns minutes ago", () => {
    const now = new Date("2025-01-01T12:30:00Z");
    const ts = "2025-01-01T12:25:00Z";
    expect(relativeTime(ts, now)).toBe("5m ago");
  });

  test("returns hours ago", () => {
    const now = new Date("2025-01-01T12:00:00Z");
    const ts = "2025-01-01T10:00:00Z";
    expect(relativeTime(ts, now)).toBe("2h ago");
  });

  test("returns days ago", () => {
    const now = new Date("2025-01-10T00:00:00Z");
    const ts = "2025-01-07T00:00:00Z";
    expect(relativeTime(ts, now)).toBe("3d ago");
  });

  test("returns date string for old timestamps", () => {
    const now = new Date("2025-06-01T00:00:00Z");
    const ts = "2024-12-01T00:00:00Z";
    expect(relativeTime(ts, now)).toBe("2024-12-01");
  });

  test("returns raw timestamp for unparseable input", () => {
    expect(relativeTime("not-a-date")).toBe("not-a-date");
  });
});

describe("extractJsonFromText", () => {
  test("extracts JSON from ```json code block", () => {
    const text = 'Here is data:\n```json\n{"key": "value"}\n```\nDone';
    const result = extractJsonFromText(text);
    expect(result).toEqual({ key: "value" });
  });

  test("extracts JSON from ``` code block", () => {
    const text = '```\n{"key": "value"}\n```';
    const result = extractJsonFromText(text);
    expect(result).toEqual({ key: "value" });
  });

  test("extracts JSON array", () => {
    const text = '```json\n[1, 2, 3]\n```';
    const result = extractJsonFromText(text);
    expect(result).toEqual([1, 2, 3]);
  });

  test("extracts JSON from surrounding text", () => {
    const text = 'The result is {"a": 1} and more';
    const result = extractJsonFromText(text);
    expect(result).toEqual({ a: 1 });
  });

  test("returns null for non-JSON", () => {
    expect(extractJsonFromText("just plain text")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(extractJsonFromText("")).toBeNull();
  });

  test("returns null for invalid JSON in block", () => {
    expect(extractJsonFromText("```json\n{invalid}\n```")).toBeNull();
  });
});
