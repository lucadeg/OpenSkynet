/** Tests for Agent Compressor */
import { test, describe, expect } from "bun:test";
import { ContextCompressor } from "../../../src/agent/compressor";

describe("AgentCompressor", () => {
  let compressor: ContextCompressor;

  beforeEach(() => {
    compressor = new ContextCompressor();
  });

  describe("compression", () => {
    test("keeps system messages", () => {
      const messages = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "hi" },
      ];
      const result = compressor.compress(messages, 1000);
      expect(result[0].role).toBe("system");
    });

    test("keeps recent messages", () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message ${i}`,
      }));
      const result = compressor.compress(messages, 10);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    test("removes oldest when over limit", () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        role: "user",
        content: `message ${i}`,
      }));
      const result = compressor.compress(messages, 20);
      expect(result.length).toBe(20);
    });
  });

  describe("token limit", () => {
    test("respects token limit", () => {
      const messages = [
        { role: "user", content: "A".repeat(1000) },
        { role: "assistant", content: "B".repeat(1000) },
      ];
      const limit = 500;
      const result = compressor.compress(messages, limit);
      const totalChars = result.reduce((sum, m) => sum + m.content.length, 0);
      expect(totalChars).toBeLessThanOrEqual(limit * 2); // Rough estimate
    });
  });
});
