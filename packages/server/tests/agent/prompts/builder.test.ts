import { test, describe, expect } from "bun:test";
import { PromptBuilder } from "../../../src/agent/prompts/builder";

describe("PromptBuilder", () => {
  const builder = new PromptBuilder();

  test("buildSystemPrompt includes soul", () => {
    const prompt = builder.buildSystemPrompt({ soul: "You are a helpful agent." });
    expect(prompt).toContain("You are a helpful agent.");
  });

  test("buildSystemPrompt includes memory", () => {
    const prompt = builder.buildSystemPrompt({ memory: "user prefers dark mode" });
    expect(prompt).toContain("user prefers dark mode");
    expect(prompt).toContain("Relevant memory");
  });

  test("buildSystemPrompt includes skills", () => {
    const prompt = builder.buildSystemPrompt({ skills: "browser, coding" });
    expect(prompt).toContain("browser, coding");
    expect(prompt).toContain("Available skills");
  });

  test("buildSystemPrompt includes locale", () => {
    const prompt = builder.buildSystemPrompt({ locale: "en-US" });
    expect(prompt).toContain("Language/Locale: en-US");
  });

  test("buildSystemPrompt includes task", () => {
    const prompt = builder.buildSystemPrompt({ task: "fix the bug" });
    expect(prompt).toContain("Current task: fix the bug");
  });

  test("buildSystemPrompt works with no options", () => {
    const prompt = builder.buildSystemPrompt({});
    expect(prompt).toBe("");
  });

  test("buildToolPrompt formats tool results", () => {
    const result = builder.buildToolPrompt([
      { name: "bash", result: "success" },
      { name: "read", result: "file contents" },
    ]);
    expect(result).toContain("[bash]: success");
    expect(result).toContain("[read]: file contents");
    expect(result).toContain("Tool results");
  });

  test("buildToolPrompt returns empty string for no results", () => {
    expect(builder.buildToolPrompt([])).toBe("");
  });
});
