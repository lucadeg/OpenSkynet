import { test, describe, expect } from "bun:test";
import { registerBrowserTools } from "../../src/browser/tools";
import type { ToolDefinition } from "../../src/core/types";

function makeMockController() {
  return {} as any;
}

describe("registerBrowserTools", () => {
  const tools = registerBrowserTools(makeMockController());

  test("returns array of ToolDefinition", () => {
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  test("each tool has required fields", () => {
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(typeof tool.parameters).toBe("object");
      expect(tool.parameters).not.toBeNull();
    }
  });

  test("each tool has a parameters object with type 'object'", () => {
    for (const tool of tools) {
      expect((tool.parameters as Record<string, unknown>).type).toBe("object");
    }
  });

  test("registers 19 tools", () => {
    expect(tools.length).toBe(19);
  });

  test("all tools have toolset set to 'browser'", () => {
    for (const tool of tools) {
      expect(tool.toolset).toBe("browser");
    }
  });

  test("contains expected tool names", () => {
    const names = tools.map((t) => t.name);
    expect(names).toContain("browser_navigate");
    expect(names).toContain("browser_click");
    expect(names).toContain("browser_type");
    expect(names).toContain("browser_snapshot");
    expect(names).toContain("browser_screenshot");
    expect(names).toContain("browser_scroll");
    expect(names).toContain("browser_extract_text");
    expect(names).toContain("browser_save_checkpoint");
    expect(names).toContain("browser_restore_checkpoint");
  });
});
