/** Tests for Coding Agent Prompts */
import { test, describe, expect } from "bun:test";
import { buildSystemPrompt, buildTaskPrompt, buildVerificationPrompt } from "../../../src/agent/coding-agent/prompts";
import type { ProjectInfo } from "../../../src/agent/coding-agent/types";

describe("CodingAgentPrompts", () => {
  describe("buildSystemPrompt", () => {
    test("includes basic instructions", () => {
      const prompt = buildSystemPrompt({});
      expect(prompt).toBeDefined();
      expect(prompt).toContain("coding agent");
    });

    test("includes project context", () => {
      const project: ProjectInfo = {
        name: "test-project",
        language: "TypeScript",
      };
      const prompt = buildSystemPrompt({ project });
      expect(prompt).toContain("test-project");
      expect(prompt).toContain("TypeScript");
    });

    test("includes tools list", () => {
      const prompt = buildSystemPrompt({});
      expect(prompt).toContain("Available Tools");
    });

    test("includes guidelines", () => {
      const prompt = buildSystemPrompt({});
      expect(prompt).toContain("Guidelines");
    });
  });

  describe("buildTaskPrompt", () => {
    test("includes task description", () => {
      const prompt = buildTaskPrompt("Test task");
      expect(prompt).toContain("Test task");
    });

    test("includes file contents", () => {
      const prompt = buildTaskPrompt("task", {
        fileContents: {
          "test.ts": "const x = 1;",
        },
      });
      expect(prompt).toContain("test.ts");
      expect(prompt).toContain("const x = 1;");
    });

    test("includes previous error", () => {
      const prompt = buildTaskPrompt("task", {
        error: "Syntax error",
      });
      expect(prompt).toContain("Syntax error");
    });
  });

  describe("buildVerificationPrompt", () => {
    test("includes file edits", () => {
      const prompt = buildVerificationPrompt([
        { path: "test.ts", content: "code" },
      ]);
      expect(prompt).toContain("test.ts");
    });

    test("includes verification instructions", () => {
      const prompt = buildVerificationPrompt([]);
      expect(prompt).toContain("Verify");
    });
  });
});
