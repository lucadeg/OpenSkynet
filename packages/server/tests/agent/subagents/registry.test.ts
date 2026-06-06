import { test, describe, expect } from "bun:test";
import { SubagentRegistry } from "../../../src/agent/subagents/registry";
import type { AgentTemplate } from "../../../src/agent/subagents/template";

describe("SubagentRegistry", () => {
  test("list returns all builtin templates", () => {
    const registry = new SubagentRegistry();
    const templates = registry.list();
    expect(templates.length).toBeGreaterThanOrEqual(4);
    const modes = templates.map((t) => t.mode);
    expect(modes).toContain("browser");
    expect(modes).toContain("coding");
    expect(modes).toContain("orchestrator");
    expect(modes).toContain("chat");
  });

  test("get returns template by mode", () => {
    const registry = new SubagentRegistry();
    const browser = registry.get("browser");
    expect(browser).toBeDefined();
    expect(browser!.label).toBe("Browser Agent");
  });

  test("get returns undefined for unknown mode", () => {
    const registry = new SubagentRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  test("register and get custom template", () => {
    const registry = new SubagentRegistry();
    const custom: AgentTemplate = {
      mode: "custom",
      label: "Custom Agent",
      description: "A custom agent",
      runner: "custom-runner",
      capabilities: ["custom"],
    };
    registry.register(custom);
    expect(registry.get("custom")).toEqual(custom);
    expect(registry.list().map((t) => t.mode)).toContain("custom");
  });

  test("unregister removes a template", () => {
    const registry = new SubagentRegistry();
    expect(registry.get("chat")).toBeDefined();
    expect(registry.unregister("chat")).toBe(true);
    expect(registry.get("chat")).toBeUndefined();
  });

  test("unregister returns false for unknown mode", () => {
    const registry = new SubagentRegistry();
    expect(registry.unregister("nonexistent")).toBe(false);
  });
});
