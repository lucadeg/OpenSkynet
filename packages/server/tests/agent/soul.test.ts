import { test, describe, expect } from "bun:test";
import { getDefaultSoul } from "../../src/agent/soul";

describe("getDefaultSoul", () => {
  test("returns a non-empty string", () => {
    const soul = getDefaultSoul();
    expect(typeof soul).toBe("string");
    expect(soul.length).toBeGreaterThan(0);
  });

  test("contains core principles", () => {
    const soul = getDefaultSoul();
    expect(soul).toContain("AI agent");
    expect(soul).toContain("safety");
  });
});
