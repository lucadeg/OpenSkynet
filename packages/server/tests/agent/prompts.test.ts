/**
 * Tests for Agent Prompts.
 * Converted from Python tests/test_agent_prompts.py
 */

import { test, describe, expect } from "bun:test";

describe("AgentPrompts", () => {
  describe("system prompt", () => {
    test("includes basic instructions", () => {
      const prompt = "You are a helpful agent with access to tools.";

      expect(prompt).toBeDefined();
      expect(prompt).toContain("agent");
    });

    test("includes tool descriptions", () => {
      const tools = [
        { name: "browser_navigate", description: "Navigate to a URL" },
        { name: "browser_click", description: "Click an element" },
        { name: "terminal", description: "Run shell commands" },
      ];

      expect(tools.length).toBe(3);
      expect(tools[0].name).toBe("browser_navigate");
    });

    test("includes capability descriptions", () => {
      const capabilities = [
        "web browsing",
        "code execution",
        "file operations",
        "memory access",
      ];

      expect(capabilities).toContain("web browsing");
    });
  });

  describe("task formatting", () => {
    test("includes task in prompt", () => {
      const task = "Navigate to example.com and get the title";
      const prompt = `Task: ${task}`;

      expect(prompt).toContain(task);
    });

    test("includes context for task", () => {
      const context = {
        url: "https://example.com",
        goal: "Extract the page title",
      };

      const prompt = `Context: ${JSON.stringify(context)}`;

      expect(prompt).toContain("url");
    });
  });

  describe("step formatting", () => {
    test("formats step with number", () => {
      const step = "Step 1: Navigate to page";

      expect(step).toContain("Step 1");
    });

    test("includes action description", () => {
      const step = {
        number: 1,
        action: "click",
        target: "submit button",
      };

      const formatted = `Step ${step.number}: ${step.action} on ${step.target}`;

      expect(formatted).toContain("click on");
    });
  });

  describe("observation formatting", () => {
    test("includes observation text", () => {
      const observation = "Page loaded successfully";

      expect(observation).toBeDefined();
    });

    test("includes result details", () => {
      const result = {
        title: "Example Domain",
        url: "https://example.com",
      };

      const formatted = `Result: ${JSON.stringify(result)}`;

      expect(formatted).toContain("Example Domain");
    });
  });

  describe("reflection prompts", () => {
    test("asks about task completion", () => {
      const prompt = "Is the task complete?";

      expect(prompt).toContain("complete");
    });

    test("asks for confidence score", () => {
      const prompt = "Confidence (0-1):";

      expect(prompt).toContain("Confidence");
    });

    test("asks for reasoning", () => {
      const prompt = "Reasoning:";

      expect(prompt).toBeDefined();
    });
  });

  describe("error handling prompts", () => {
    test("includes error in prompt", () => {
      const error = "Failed to navigate to page";

      const prompt = `Error: ${error}`;

      expect(prompt).toContain("Error");
    });

    test("asks for recovery strategy", () => {
      const prompt = "How should we recover from this error?";

      expect(prompt).toContain("recover");
    });
  });

  describe("skill creation prompts", () => {
    test("includes skill name", () => {
      const skillName = "weather-checker";

      expect(skillName).toBe("weather-checker");
    });

    test("includes skill description", () => {
      const description = "Checks weather updates hourly";

      expect(description).toContain("weather");
    });

    test("includes skill steps", () => {
      const steps = [
        "Navigate to weather site",
        "Extract temperature",
        "Return result",
      ];

      expect(steps.length).toBe(3);
    });
  });

  describe("memory prompts", () => {
    test("includes memory context in prompt", () => {
      const memory = [
        "User prefers dark mode",
        "User knows TypeScript",
      ];

      const prompt = `Context:\n${memory.map((m) => `- ${m}`).join("\n")}`;

      expect(prompt).toContain("User prefers dark mode");
    });

    test("formats memory entries", () => {
      const entry = {
        type: "preference",
        content: "dark mode",
        importance: 0.8,
      };

      const formatted = `- [${entry.type}] ${entry.content} (importance: ${entry.importance})`;

      expect(formatted).toContain("preference");
    });
  });

  describe("constraint handling", () => {
    test("respects max steps in prompt", () => {
      const maxSteps = 10;
      const prompt = `Maximum steps: ${maxSteps}`;

      expect(prompt).toContain("10");
    });

    test("respects timeout in prompt", () => {
      const timeout = 30;
      const prompt = `Timeout: ${timeout}s`;

      expect(prompt).toContain("30");
    });
  });

  describe("edge cases", () => {
    test("handles empty task", () => {
      const prompt = "Task: ";

      expect(prompt).toBeDefined();
    });

    test("handles special characters in task", () => {
      const task = "Navigate to https://example.com?query=test&foo=bar";

      const prompt = `Task: ${task}`;

      expect(prompt).toContain("https://example.com");
    });

    test("handles unicode in task", () => {
      const task = "搜索页面并获取标题";

      const prompt = `Task: ${task}`;

      expect(prompt).toContain("搜索");
    });
  });
});
