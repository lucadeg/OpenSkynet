import { test, describe, expect } from "bun:test";
import { MemoryExtractor } from "../../src/memory/strategies/hy/extractor";

describe("MemoryExtractor", () => {
  const extractor = new MemoryExtractor();

  test("extractFromConversation returns entries with content and type", () => {
    const messages = [
      { role: "user", content: "My name is Alice and I am a software engineer working on distributed systems." },
    ];
    const results = extractor.extractFromConversation(messages);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.content).toBeTruthy();
      expect(["fact", "preference", "procedure", "episodic"]).toContain(r.type);
      expect(typeof r.importance).toBe("number");
    }
  });

  test("detects facts from factual statements", () => {
    const messages = [
      { role: "user", content: "I am a backend developer. The project is built with TypeScript and Node.js." },
    ];
    const results = extractor.extractFromConversation(messages);
    const facts = results.filter((r) => r.type === "fact");
    expect(facts.length).toBeGreaterThan(0);
  });

  test("detects preferences from user preferences", () => {
    const messages = [
      { role: "user", content: "I prefer using dark mode for all my editors. I like vim keybindings." },
    ];
    const results = extractor.extractFromConversation(messages);
    const prefs = results.filter((r) => r.type === "preference");
    expect(prefs.length).toBeGreaterThan(0);
  });

  test("detects procedural statements", () => {
    const messages = [
      { role: "assistant", content: "First you need to install the dependencies. Then you should configure the environment variables." },
    ];
    const results = extractor.extractFromConversation(messages);
    const procs = results.filter((r) => r.type === "procedure");
    expect(procs.length).toBeGreaterThan(0);
  });

  test("detects episodic statements", () => {
    const messages = [
      { role: "user", content: "Yesterday I went to the conference and saw a great talk about WebAssembly." },
    ];
    const results = extractor.extractFromConversation(messages);
    const epics = results.filter((r) => r.type === "episodic");
    expect(epics.length).toBeGreaterThan(0);
  });

  test("returns empty for empty conversation", () => {
    expect(extractor.extractFromConversation([])).toEqual([]);
  });
});
