import { test, describe, expect } from "bun:test";
import { MiscProvider } from "../../../../src/agent/tools/providers/misc-provider";
import { ToolBus } from "../../../../src/agent/tools/bus";

describe("MiscProvider", () => {
  test("registers misc tools on the bus", () => {
    const bus = new ToolBus();
    const provider = new MiscProvider();
    provider.register(bus);
    expect(bus.list().length).toBeGreaterThan(0);
  });

  test("registers expected tool names", () => {
    const bus = new ToolBus();
    const provider = new MiscProvider();
    provider.register(bus);
    const names = bus.list();
    expect(names).toContain("memory_add");
    expect(names).toContain("memory_search");
    expect(names).toContain("todo_read");
    expect(names).toContain("todo_write");
    expect(names).toContain("think");
  });

  test("all misc tools have toolset 'misc'", () => {
    const bus = new ToolBus();
    const provider = new MiscProvider();
    provider.register(bus);
    const defs = bus.getDefinitions();
    for (const def of defs) {
      expect(def.toolset).toBe("misc");
    }
  });

  test("registers 5 misc tools", () => {
    const bus = new ToolBus();
    const provider = new MiscProvider();
    provider.register(bus);
    expect(bus.list().length).toBe(5);
  });

  test("think executor returns thought content", async () => {
    const bus = new ToolBus();
    const provider = new MiscProvider();
    provider.register(bus);
    const result = await bus.execute("think", { thought: "test reasoning" });
    expect(result.success).toBe(true);
    expect(result.output).toBe("test reasoning");
  });
});
