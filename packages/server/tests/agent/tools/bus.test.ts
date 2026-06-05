import { test, describe, expect } from "bun:test";
import { ToolBus } from "../../../src/agent/tools/bus";
import type { ToolDefinition } from "../../../src/core/types";
import type { ToolExecutor } from "../../../src/agent/tools/interfaces";

describe("ToolBus", () => {
  test("register and execute tools", async () => {
    const bus = new ToolBus();
    const def: ToolDefinition = {
      name: "add",
      description: "Add numbers",
      parameters: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } } },
    };
    const exec: ToolExecutor = async (_name, args) => ({
      success: true,
      output: String(Number(args.a) + Number(args.b)),
    });
    bus.register(def, exec);
    const result = await bus.execute("add", { a: 2, b: 3 });
    expect(result.success).toBe(true);
    expect(result.output).toBe("5");
  });

  test("execute returns error for unknown tool", async () => {
    const bus = new ToolBus();
    const result = await bus.execute("nonexistent", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });

  test("getDefinitions returns correct list", () => {
    const bus = new ToolBus();
    const dummy: ToolExecutor = async () => ({ success: true, output: "" });
    bus.register({ name: "tool-a", description: "A", parameters: {} }, dummy);
    bus.register({ name: "tool-b", description: "B", parameters: {} }, dummy);
    const defs = bus.getDefinitions();
    expect(defs.length).toBe(2);
    expect(defs.map((d) => d.name).sort()).toEqual(["tool-a", "tool-b"]);
  });

  test("unregister removes tool", async () => {
    const bus = new ToolBus();
    const dummy: ToolExecutor = async () => ({ success: true, output: "" });
    bus.register({ name: "temp", description: "T", parameters: {} }, dummy);
    expect(bus.has("temp")).toBe(true);
    expect(bus.unregister("temp")).toBe(true);
    expect(bus.has("temp")).toBe(false);
    const result = await bus.execute("temp", {});
    expect(result.success).toBe(false);
  });
});
