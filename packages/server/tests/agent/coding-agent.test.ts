/**
 * Tests for Coding Agent system.
 * Converted from Python tests/test_coding_agent.py
 */

import { test, describe, expect, mock } from "bun:test";
import { CodingAgent, createCodingAgent } from "../../src/agent/coding-agent";
import type { ProjectInfo, CodingResult } from "../../src/agent/coding-agent/types";

describe("CodingAgent", () => {
  describe("CodingResult", () => {
    test("defaults", () => {
      const result: CodingResult = {
        success: true,
        edits: [],
        errors: [],
        summary: "",
      };
      expect(result.success).toBe(true);
      expect(result.edits).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    test("with edits", () => {
      const result: CodingResult = {
        success: true,
        edits: [
          {
            path: "src/app.py",
            originalContent: "",
            newContent: "print('hello')",
            edits: [],
          },
          {
            path: "tests/test_app.py",
            originalContent: "",
            newContent: "assert True",
            edits: [],
          },
        ],
        errors: [],
        summary: "",
      };
      expect(result.edits.length).toBe(2);
      expect(result.edits[0].path).toBe("src/app.py");
    });

    test("with verification results", () => {
      const result: CodingResult = {
        success: true,
        edits: [],
        errors: [],
        summary: "",
        verificationResults: [
          {
            filePath: "test.py",
            passed: true,
            errors: [],
            warnings: [],
          },
        ],
      };
      expect(result.verificationResults).toBeDefined();
      expect(result.verificationResults![0].passed).toBe(true);
    });
  });

  describe("createCodingAgent", () => {
    test("returns CodingAgent instance", async () => {
      const mockLLM = {
        chat: async () => ({
          text: "response",
          tool_calls: [],
          done: true,
        }),
      } as any;

      const agent = await createCodingAgent({
        llm: mockLLM,
        autoDiscoverProject: false,
      });

      expect(agent).toBeDefined();
      expect(agent instanceof CodingAgent).toBe(true);
    });

    test("uses provided project info", async () => {
      const mockLLM = {
        chat: async () => ({
          text: "response",
          tool_calls: [],
          done: true,
        }),
      } as any;

      const projectInfo: ProjectInfo = {
        name: "test-project",
        language: "typescript",
      };

      const agent = await createCodingAgent({
        llm: mockLLM,
        projectInfo,
        autoDiscoverProject: false,
      });

      expect(agent.getProjectInfo()).toEqual(projectInfo);
    });
  });

  describe("CodingAgent execution", () => {
    test("executes task and returns result", async () => {
      const mockLLM = {
        chat: async () => ({
          text: "Task completed",
          tool_calls: [],
          done: true,
        }),
      } as any;

      const agent = await createCodingAgent({
        llm: mockLLM,
        autoDiscoverProject: false,
        enableHooks: false,
      });

      const result = await agent.execute("install express");

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test("tracks edited files", async () => {
      const mockLLM = {
        chat: async () => ({
          text: "Files edited",
          tool_calls: [
            {
              name: "write_file",
              arguments: {
                path: "/tmp/test.py",
                content: "print('hello')",
              },
            },
          ],
          done: true,
        }),
      } as any;

      const agent = await createCodingAgent({
        llm: mockLLM,
        autoDiscoverProject: false,
        enableHooks: false,
      });

      const result = await agent.execute("create test file");

      expect(result.edits.length).toBeGreaterThan(0);
      expect(agent.getEditedFiles()).toContain("/tmp/test.py");
    });

    test("handles conversation history", async () => {
      const mockLLM = {
        chat: async () => ({
          text: "Response",
          tool_calls: [],
          done: true,
        }),
      } as any;

      const agent = await createCodingAgent({
        llm: mockLLM,
        autoDiscoverProject: false,
        conversationHistory: [
          { role: "user", content: "previous question" },
          { role: "assistant", content: "previous answer" },
        ],
      });

      agent.addToHistory("user", "new question");
      expect(agent.getEditedFiles()).toEqual([]);
    });
  });

  describe("Project discovery", () => {
    test("detects TypeScript project", async () => {
      const mockLLM = {
        chat: async () => ({
          text: "response",
          tool_calls: [],
          done: true,
        }),
      } as any;

      const agent = await createCodingAgent({
        llm: mockLLM,
        projectInfo: {
          language: "typescript",
          packageManager: "npm",
        },
        autoDiscoverProject: false,
      });

      const project = agent.getProjectInfo();
      expect(project.language).toBe("typescript");
      expect(project.packageManager).toBe("npm");
    });
  });
});

describe("CodingAgentHooks", () => {
  test("pre-hook can prevent execution", async () => {
    const mockLLM = {
      chat: async () => ({
        text: "response",
        tool_calls: [],
        done: true,
      }),
    } as any;

    let preHookCalled = false;
    const mockPipeline = {
      name: "test",
      preHooks: [],
      postHooks: [],
      registerPreHook: () => {},
      registerPostHook: () => {},
      executePreHooks: async () => {
        preHookCalled = true;
        return { continue: false };
      },
      executePostHooks: async () => ({ status: "success" as const }),
    };

    const agent = await createCodingAgent({
      llm: mockLLM,
      hooks: mockPipeline,
      autoDiscoverProject: false,
    });

    const result = await agent.execute("test task");

    expect(preHookCalled).toBe(true);
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Pre-hooks prevented execution");
  });

  test("pre-hook can modify task", async () => {
    const mockLLM = {
      chat: async (msgs: any[]) => ({
        text: `Modified: ${msgs[msgs.length - 1].content}`,
        tool_calls: [],
        done: true,
      }),
    } as any;

    const mockPipeline = {
      name: "test",
      preHooks: [],
      postHooks: [],
      registerPreHook: () => {},
      registerPostHook: () => {},
      executePreHooks: async () => ({
        continue: true,
        modifications: { task: "modified task" },
      }),
      executePostHooks: async () => ({ status: "success" as const }),
    };

    const agent = await createCodingAgent({
      llm: mockLLM,
      hooks: mockPipeline,
      autoDiscoverProject: false,
    });

    const result = await agent.execute("original task");
    expect(result.summary).toContain("modified task");
  });
});
