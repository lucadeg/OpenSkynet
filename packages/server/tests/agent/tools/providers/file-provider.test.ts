import { test, describe, expect } from "bun:test";
import { FileProvider } from "../../../../src/agent/tools/providers/file-provider";
import { ToolBus } from "../../../../src/agent/tools/bus";

describe("FileProvider", () => {
  test("registers file tools on the bus", () => {
    const bus = new ToolBus();
    const provider = new FileProvider();
    provider.register(bus);
    const tools = bus.list();
    expect(tools.length).toBeGreaterThan(0);
  });

  test("registers expected tool names", () => {
    const bus = new ToolBus();
    const provider = new FileProvider();
    provider.register(bus);
    const names = bus.list();
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).toContain("list_directory");
    expect(names).toContain("create_directory");
    expect(names).toContain("delete_file");
    expect(names).toContain("move_file");
    expect(names).toContain("search_files");
  });

  test("all file tools have toolset 'file'", () => {
    const bus = new ToolBus();
    const provider = new FileProvider();
    provider.register(bus);
    const defs = bus.getDefinitions();
    for (const def of defs) {
      expect(def.toolset).toBe("file");
    }
  });

  test("each tool has required definition fields", () => {
    const bus = new ToolBus();
    const provider = new FileProvider();
    provider.register(bus);
    const defs = bus.getDefinitions();
    for (const def of defs) {
      expect(typeof def.name).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(typeof def.parameters).toBe("object");
    }
  });

  test("registers 7 file tools", () => {
    const bus = new ToolBus();
    const provider = new FileProvider();
    provider.register(bus);
    expect(bus.list().length).toBe(7);
  });
});
