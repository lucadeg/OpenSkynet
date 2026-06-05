/** Tests for Subagents Registry */
import { test, describe, expect } from "bun:test";
import { SubagentRegistry } from "../../../src/agent/subagents/registry";
import type { AgentTemplate } from "../../../src/agent/subagents/template";

describe("SubagentRegistry", () => {
  describe("registry management", () => {
    test("registers template", () => {
      const registry = new SubagentRegistry();
      const template: AgentTemplate = {
        mode: "test",
        label: "Test Agent",
        description: "Test description",
        runner: "test-runner",
        capabilities: ["test"],
      };
      registry.register(template);
      const retrieved = registry.get("test");
      expect(retrieved?.mode).toBe("test");
    });

    test("unregisters template", () => {
      const registry = new SubagentRegistry();
      const template: AgentTemplate = {
        mode: "test",
        label: "Test Agent",
        description: "Test description",
        runner: "test-runner",
        capabilities: ["test"],
      };
      registry.register(template);
      const unregistered = registry.unregister("test");
      expect(unregistered).toBe(true);
      expect(registry.get("test")).toBeUndefined();
    });

    test("returns false when unregistering non-existent template", () => {
      const registry = new SubagentRegistry();
      const unregistered = registry.unregister("nonexistent");
      expect(unregistered).toBe(false);
    });
  });

  describe("template retrieval", () => {
    test("gets template by mode", () => {
      const registry = new SubagentRegistry();
      const template = registry.get("coding");
      expect(template).toBeDefined();
      expect(template?.mode).toBe("coding");
    });

    test("returns undefined for unknown mode", () => {
      const registry = new SubagentRegistry();
      const template = registry.get("unknown-mode");
      expect(template).toBeUndefined();
    });
  });

  describe("template listing", () => {
    test("lists all templates", () => {
      const registry = new SubagentRegistry();
      const templates = registry.list();
      expect(templates.length).toBeGreaterThan(0);
    });

    test("includes custom templates in list", () => {
      const registry = new SubagentRegistry();
      const template: AgentTemplate = {
        mode: "custom",
        label: "Custom Agent",
        description: "Custom description",
        runner: "custom-runner",
        capabilities: ["custom"],
      };
      registry.register(template);
      const templates = registry.list();
      const hasCustom = templates.some((t: AgentTemplate) => t.mode === "custom");
      expect(hasCustom).toBe(true);
    });
  });

  describe("builtin templates", () => {
    test("includes coding template", () => {
      const registry = new SubagentRegistry();
      const template = registry.get("coding");
      expect(template).toBeDefined();
      expect(template?.label).toBe("Coding Agent");
    });

    test("includes browser template", () => {
      const registry = new SubagentRegistry();
      const template = registry.get("browser");
      expect(template).toBeDefined();
      expect(template?.label).toBe("Browser Agent");
    });

    test("includes chat template", () => {
      const registry = new SubagentRegistry();
      const template = registry.get("chat");
      expect(template).toBeDefined();
      expect(template?.label).toBe("Chat Agent");
    });

    test("includes orchestrator template", () => {
      const registry = new SubagentRegistry();
      const template = registry.get("orchestrator");
      expect(template).toBeDefined();
      expect(template?.label).toBe("Orchestrator Agent");
    });
  });
});
