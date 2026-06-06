import { test, describe, expect } from "bun:test";
import {
  estimateTokens,
  getModelContextWindow,
  estimateCost,
  TokenTracker,
  MODEL_CONTEXT_WINDOWS,
} from "../../src/llm/tokens";

describe("estimateTokens", () => {
  test("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  test("returns reasonable estimate for English text", () => {
    const tokens = estimateTokens("Hello, how are you doing today?");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(50);
  });

  test("handles CJK characters with different ratio", () => {
    const cjk = "你好世界测试";
    const latin = "hello";
    expect(estimateTokens(cjk)).not.toBe(estimateTokens(latin));
  });
});

describe("getModelContextWindow", () => {
  test("returns correct size for known models", () => {
    expect(getModelContextWindow("gpt-4o")).toBe(128000);
    expect(getModelContextWindow("gpt-4")).toBe(8192);
    expect(getModelContextWindow("claude-3-5-sonnet")).toBe(200000);
  });

  test("returns default for unknown models", () => {
    expect(getModelContextWindow("unknown-model-xyz")).toBe(8192);
  });

  test("does case-insensitive matching", () => {
    expect(getModelContextWindow("GPT-4O")).toBe(128000);
  });
});

describe("estimateCost", () => {
  test("calculates correctly for known model", () => {
    const cost = estimateCost(1000, 1000, "gpt-4o");
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeCloseTo(0.0025 + 0.01, 4);
  });

  test("returns 0 for unknown model", () => {
    const cost = estimateCost(1000, 1000, "unknown-xyz");
    expect(cost).toBe(0);
  });
});

describe("TokenTracker", () => {
  test("records and summarizes", () => {
    const tracker = new TokenTracker();
    tracker.record("gpt-4o", 100, 50);
    tracker.record("gpt-4o", 200, 100);

    expect(tracker.totalInputTokens).toBe(300);
    expect(tracker.totalOutputTokens).toBe(150);
    expect(tracker.totalCalls).toBe(2);
    expect(tracker.totalCost).toBeGreaterThan(0);
  });

  test("summary returns correct shape", () => {
    const tracker = new TokenTracker();
    tracker.record("gpt-4o", 100, 50);
    const s = tracker.summary();
    expect(s).toHaveProperty("totalInputTokens");
    expect(s).toHaveProperty("totalOutputTokens");
    expect(s).toHaveProperty("totalCost");
    expect(s).toHaveProperty("totalCalls");
    expect(s).toHaveProperty("lastModel");
    expect((s as any).lastModel).toBe("gpt-4o");
  });

  test("reset clears all state", () => {
    const tracker = new TokenTracker();
    tracker.record("gpt-4o", 100, 50);
    tracker.reset();
    expect(tracker.totalInputTokens).toBe(0);
    expect(tracker.totalOutputTokens).toBe(0);
    expect(tracker.totalCalls).toBe(0);
    expect(tracker.totalCost).toBe(0);
  });
});
