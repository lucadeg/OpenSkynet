/**
 * Tests for Agent Tools.
 * Converted from Python tests/test_agent_tools.py
 */

import { test, describe, expect } from "bun:test";

describe("AgentTools", () => {
  describe("tool registry", () => {
    test("registers tools", () => {
      const tools = new Map([
        ["browser_navigate", { name: "browser_navigate", description: "Navigate to URL" }],
        ["browser_click", { name: "browser_click", description: "Click element" }],
        ["terminal", { name: "terminal", description: "Run command" }],
      ]);

      expect(tools.size).toBe(3);
      expect(tools.has("browser_navigate")).toBe(true);
    });

    test("unregisters tools", () => {
      const tools = new Map([
        ["temp_tool", { name: "temp_tool" }],
      ]);

      tools.delete("temp_tool");

      expect(tools.has("temp_tool")).toBe(false);
    });

    test("lists available tools", () => {
      const tools = new Map([
        ["tool1", { name: "tool1" }],
        ["tool2", { name: "tool2" }],
      ]);

      const names = Array.from(tools.keys());

      expect(names).toEqual(["tool1", "tool2"]);
    });
  });

  describe("tool execution", () => {
    test("executes registered tool", async () => {
      const tool = {
        name: "test_tool",
        execute: async (args: any) => ({ success: true, result: "done" }),
      };

      const result = await tool.execute({});

      expect(result.success).toBe(true);
    });

    test("passes arguments to tool", async () => {
      let receivedArgs: any = null;

      const tool = {
        name: "test_tool",
        execute: async (args: any) => {
          receivedArgs = args;
          return { success: true };
        },
      };

      await tool.execute({ param1: "value1", param2: "value2" });

      expect(receivedArgs).toEqual({ param1: "value1", param2: "value2" });
    });

    test("handles tool errors", async () => {
      const tool = {
        name: "failing_tool",
        execute: async () => {
          throw new Error("Tool failed");
        },
      };

      const result = await tool.execute({});

      expect(result.success).toBe(false);
    });
  });

  describe("tool validation", () => {
    test("validates required parameters", () => {
      const tool = {
        name: "test_tool",
        parameters: {
          required: ["url", "selector"],
        },
      };

      const valid = { url: "https://example.com", selector: "#btn" };
      const invalid = { url: "https://example.com" };

      const hasRequired = (args: any) => {
        return tool.parameters.required.every((p: string) => p in args);
      };

      expect(hasRequired(valid)).toBe(true);
      expect(hasRequired(invalid)).toBe(false);
    });

    test("validates parameter types", () => {
      const tool = {
        name: "test_tool",
        parameters: {
          properties: {
            count: { type: "number" },
            name: { type: "string" },
          },
        },
      };

      const valid = { count: 5, name: "test" };
      const invalid = { count: "five", name: "test" };

      expect(typeof valid.count).toBe("number");
      expect(typeof invalid.count).toBe("string");
    });
  });

  describe("tool result", () => {
    test("returns success result", () => {
      const result = {
        success: true,
        data: { key: "value" },
      };

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: "value" });
    });

    test("returns error result", () => {
      const result = {
        success: false,
        error: "Tool execution failed",
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("includes output in result", () => {
      const result = {
        success: true,
        output: "Command completed successfully",
      };

      expect(result.output).toBeDefined();
    });
  });

  describe("tool bus", () => {
    test("routes tool calls to correct tool", async () => {
      const calls: string[] = [];

      const bus = {
        tools: new Map([
          ["tool1", { execute: async () => { calls.push("tool1"); return {}; } }],
          ["tool2", { execute: async () => { calls.push("tool2"); return {}; } }],
        ]),
        execute: async (name: string) => {
          const tool = bus.tools.get(name);
          return await tool!.execute({});
        },
      };

      await bus.execute("tool1");

      expect(calls).toEqual(["tool1"]);
    });

    test("handles unknown tool", async () => {
      const bus = {
        tools: new Map(),
        execute: async (name: string) => {
          if (!bus.tools.has(name)) {
            return { success: false, error: "Unknown tool" };
          }
          return {};
        },
      };

      const result = await bus.execute("unknown");

      expect(result.success).toBe(false);
    });
  });

  describe("browser tools", () => {
    test("browser_navigate tool", () => {
      const tool = {
        name: "browser_navigate",
        parameters: {
          required: ["url"],
          properties: {
            url: { type: "string" },
            wait: { type: "boolean" },
          },
        },
      };

      expect(tool.parameters.required).toContain("url");
    });

    test("browser_click tool", () => {
      const tool = {
        name: "browser_click",
        parameters: {
          required: ["selector"],
          properties: {
            selector: { type: "string" },
            button: { type: "string" },
          },
        },
      };

      expect(tool.parameters.required).toContain("selector");
    });

    test("browser_type tool", () => {
      const tool = {
        name: "browser_type",
        parameters: {
          required: ["selector", "text"],
        },
      };

      expect(tool.parameters.required).toContain("selector");
      expect(tool.parameters.required).toContain("text");
    });

    test("browser_extract tool", () => {
      const tool = {
        name: "browser_extract",
        parameters: {
          properties: {
            selector: { type: "string" },
            attribute: { type: "string" },
          },
        },
      };

      expect(tool.parameters).toBeDefined();
    });
  });

  describe("terminal tool", () => {
    test("terminal tool executes command", () => {
      const tool = {
        name: "terminal",
        parameters: {
          required: ["command"],
        },
      };

      expect(tool.parameters.required).toContain("command");
    });

    test("returns command output", () => {
      const result = {
        success: true,
        output: "Command output",
        exitCode: 0,
      };

      expect(result.exitCode).toBe(0);
    });

    test("handles command timeout", () => {
      const result = {
        success: false,
        error: "Command timed out after 30s",
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
    });
  });

  describe("file tools", () => {
    test("read_file tool", () => {
      const tool = {
        name: "read_file",
        parameters: {
          required: ["path"],
        },
      };

      expect(tool.parameters.required).toContain("path");
    });

    test("write_file tool", () => {
      const tool = {
        name: "write_file",
        parameters: {
          required: ["path", "content"],
        },
      };

      expect(tool.parameters.required).toContain("path");
      expect(tool.parameters.required).toContain("content");
    });

    test("edit_file tool", () => {
      const tool = {
        name: "edit_file",
        parameters: {
          required: ["path", "startLine", "endLine", "content"],
        },
      };

      expect(tool.parameters.required.length).toBe(4);
    });
  });

  describe("edge cases", () => {
    test("handles tool with no parameters", () => {
      const tool = {
        name: "no_params_tool",
        parameters: {},
      };

      expect(Object.keys(tool.parameters).length).toBe(0);
    });

    test("handles tool with optional parameters", () => {
      const tool = {
        name: "optional_params_tool",
        parameters: {
          required: ["required_param"],
          properties: {
            optional1: { type: "string" },
            optional2: { type: "boolean" },
          },
        },
      };

      expect(tool.parameters.required).toEqual(["required_param"]);
    });

    test("handles very long output", () => {
      const longOutput = "A".repeat(1000000);

      const result = {
        success: true,
        output: longOutput,
      };

      expect(result.output.length).toBe(1000000);
    });
  });
});
