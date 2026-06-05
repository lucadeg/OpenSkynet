import { test, describe, expect } from "bun:test";
import { WebProvider } from "../../../../src/agent/tools/providers/web-provider";
import { ToolBus } from "../../../../src/agent/tools/bus";

describe("WebProvider", () => {
  test("registers web tools on the bus", () => {
    const bus = new ToolBus();
    const provider = new WebProvider();
    provider.register(bus);
    expect(bus.list().length).toBeGreaterThan(0);
  });

  test("registers fetch_url and search_web tools", () => {
    const bus = new ToolBus();
    const provider = new WebProvider();
    provider.register(bus);
    const names = bus.list();
    expect(names).toContain("fetch_url");
    expect(names).toContain("search_web");
  });

  test("registers exactly 2 tools", () => {
    const bus = new ToolBus();
    const provider = new WebProvider();
    provider.register(bus);
    expect(bus.list().length).toBe(2);
  });

  test("all web tools have toolset 'web'", () => {
    const bus = new ToolBus();
    const provider = new WebProvider();
    provider.register(bus);
    const defs = bus.getDefinitions();
    for (const def of defs) {
      expect(def.toolset).toBe("web");
    }
  });

  test("fetch_url has url as required parameter", () => {
    const bus = new ToolBus();
    const provider = new WebProvider();
    provider.register(bus);
    const def = bus.getDefinitions().find((d) => d.name === "fetch_url");
    expect(def).toBeDefined();
    const params = def!.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toContain("url");
  });

  test("search_web has query as required parameter", () => {
    const bus = new ToolBus();
    const provider = new WebProvider();
    provider.register(bus);
    const def = bus.getDefinitions().find((d) => d.name === "search_web");
    expect(def).toBeDefined();
    const params = def!.parameters as Record<string, unknown>;
    const required = params.required as string[];
    expect(required).toContain("query");
  });
});
