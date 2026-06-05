import { test, describe, expect } from "bun:test";
import { ContextCompressor } from "../../src/agent/compressor";

describe("ContextCompressor", () => {
  const compressor = new ContextCompressor();

  test("keeps system messages", () => {
    const messages = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "hi" },
    ];
    const result = compressor.compress(messages, 1000);
    expect(result[0].role).toBe("system");
    expect(result[0].content).toBe("You are helpful");
  });

  test("keeps recent messages", () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `message ${i}`,
    }));
    const result = compressor.compress(messages, 10);
    const lastFew = result.slice(-4);
    for (const msg of lastFew) {
      expect(msg.role).not.toBe("system");
    }
  });

  test("compress reduces total message count for long conversations", () => {
    const messages = [
      { role: "system", content: "system prompt" },
      ...Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? "user" as const : "assistant" as const,
        content: `this is message number ${i} with some extra text to pad it out`,
      })),
    ];
    const result = compressor.compress(messages, 10);
    expect(result.length).toBeLessThan(messages.length);
  });

  test("returns empty array for empty input", () => {
    expect(compressor.compress([], 100)).toEqual([]);
  });

  test("returns messages unchanged when under max tokens", () => {
    const messages = [
      { role: "user", content: "short" },
      { role: "assistant", content: "reply" },
    ];
    const result = compressor.compress(messages, 1000);
    expect(result).toEqual(messages);
  });
});
