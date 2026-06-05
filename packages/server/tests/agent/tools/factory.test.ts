import { test, describe, expect } from "bun:test";
import { createToolBus, createMinimalToolBus, createPerformanceToolBus } from "../../../src/agent/tools/factory";
import type { ToolExecutor } from "../../../src/agent/tools/interfaces";

const dummyExec: ToolExecutor = async (_name, args) => ({
  success: true,
  output: String(args.text ?? "ok"),
});

describe("createToolBus", () => {
  test("returns a ToolBus instance", () => {
    const bus = createToolBus();
    expect(bus).toBeDefined();
    expect(typeof bus.register).toBe("function");
    expect(typeof bus.execute).toBe("function");
    expect(typeof bus.list).toBe("function");
  });

  test("can register and execute tools", async () => {
    const bus = createToolBus();
    bus.register(
      { name: "echo", description: "Echo", parameters: { type: "object", properties: { text: { type: "string" } } } },
      dummyExec,
    );
    expect(bus.list()).toEqual(["echo"]);
    const result = await bus.execute("echo", { text: "hi" });
    expect(result.success).toBe(true);
    expect(result.output).toBe("hi");
  });
});

describe("createMinimalToolBus", () => {
  test("returns empty ToolBus", () => {
    const bus = createMinimalToolBus();
    expect(bus.list()).toEqual([]);
  });

  test("can register tools", () => {
    const bus = createMinimalToolBus();
    bus.register(
      { name: "tool", description: "T", parameters: {} },
      dummyExec,
    );
    expect(bus.has("tool")).toBe(true);
  });
});

describe("createPerformanceToolBus", () => {
  test("returns ToolBus that caches results", async () => {
    const bus = createPerformanceToolBus();
    bus.register(
      { name: "echo", description: "Echo", parameters: { type: "object", properties: {} } },
      dummyExec,
    );
    const r1 = await bus.execute("echo", { text: "a" });
    const r2 = await bus.execute("echo", { text: "a" });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  test("returns ToolBus with tools registered", async () => {
    const bus = createPerformanceToolBus();
    bus.register(
      { name: "perf_tool", description: "Perf", parameters: {} },
      dummyExec,
    );
    expect(bus.has("perf_tool")).toBe(true);
    const result = await bus.execute("perf_tool", {});
    expect(result.success).toBe(true);
  });
});
