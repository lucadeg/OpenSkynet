import { test, describe, expect } from "bun:test";
import { truncateMessage, formatAgentResult } from "../../src/gateway/helpers";

describe("truncateMessage", () => {
  test("keeps short messages unchanged", () => {
    expect(truncateMessage("hello")).toBe("hello");
  });

  test("truncates long messages", () => {
    const long = "a".repeat(3000);
    const result = truncateMessage(long, 2000);
    expect(result.length).toBe(2000);
    expect(result.endsWith("...")).toBe(true);
  });

  test("keeps message exactly at maxLength", () => {
    const exact = "a".repeat(2000);
    expect(truncateMessage(exact, 2000)).toBe(exact);
  });

  test("respects custom maxLength", () => {
    const msg = "a".repeat(100);
    const result = truncateMessage(msg, 50);
    expect(result.length).toBe(50);
    expect(result.endsWith("...")).toBe(true);
  });
});

describe("formatAgentResult", () => {
  test("formats correctly", () => {
    expect(formatAgentResult("  hello world  ")).toBe("hello world");
  });

  test("returns no output for empty string", () => {
    expect(formatAgentResult("")).toBe("*(no output)*");
  });

  test("returns no output for whitespace-only string", () => {
    expect(formatAgentResult("   ")).toBe("*(no output)*");
  });

  test("preserves non-whitespace content", () => {
    expect(formatAgentResult("result")).toBe("result");
  });
});
