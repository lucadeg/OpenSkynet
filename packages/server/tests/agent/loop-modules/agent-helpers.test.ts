import { test, describe, expect } from "bun:test";
import { AgentHelpers } from "../../../src/agent/loop-modules/agent-helpers";

describe("AgentHelpers", () => {
  test("truncateResult keeps short strings", () => {
    expect(AgentHelpers.truncateResult("hello")).toBe("hello");
    expect(AgentHelpers.truncateResult("a".repeat(5000))).toBe("a".repeat(5000));
  });

  test("truncateResult truncates long strings", () => {
    const input = "a".repeat(6000);
    const result = AgentHelpers.truncateResult(input);
    expect(result.length).toBeLessThan(input.length);
    expect(result).toContain("truncated");
    expect(result).toContain("1000 chars");
  });

  test("truncateResult respects custom maxChars", () => {
    const input = "a".repeat(200);
    const result = AgentHelpers.truncateResult(input, 100);
    expect(result.length).toBeLessThan(200);
    expect(result).toContain("truncated");
  });

  test("formatToolResult formats correctly", () => {
    expect(AgentHelpers.formatToolResult("browser", "page loaded")).toBe("[browser] page loaded");
    expect(AgentHelpers.formatToolResult("echo", "hello")).toBe("[echo] hello");
  });

  test("isRetryable identifies rate limit errors", () => {
    expect(AgentHelpers.isRetryable(new Error("rate limit exceeded"))).toBe(true);
    expect(AgentHelpers.isRetryable(new Error("HTTP 429"))).toBe(true);
  });

  test("isRetryable identifies timeout errors", () => {
    expect(AgentHelpers.isRetryable(new Error("Request timeout"))).toBe(true);
    expect(AgentHelpers.isRetryable(new Error("timed out after 30s"))).toBe(true);
  });

  test("isRetryable identifies connection/network errors", () => {
    expect(AgentHelpers.isRetryable(new Error("connection refused"))).toBe(true);
    expect(AgentHelpers.isRetryable(new Error("network error"))).toBe(true);
  });

  test("isRetryable identifies server errors", () => {
    expect(AgentHelpers.isRetryable(new Error("500 Internal Server Error"))).toBe(true);
    expect(AgentHelpers.isRetryable(new Error("502 Bad Gateway"))).toBe(true);
    expect(AgentHelpers.isRetryable(new Error("503 Service Unavailable"))).toBe(true);
  });

  test("isRetryable returns false for non-retryable errors", () => {
    expect(AgentHelpers.isRetryable(new Error("Not found"))).toBe(false);
    expect(AgentHelpers.isRetryable(new Error("Unauthorized"))).toBe(false);
    expect(AgentHelpers.isRetryable(new Error("Syntax error"))).toBe(false);
  });
});
