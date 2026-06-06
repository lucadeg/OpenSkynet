import { test, describe, expect, mock } from "bun:test";
import { ToolLoopExecutor } from "../../../src/agent/execution/tool-loop-executor";

describe("ToolLoopExecutor", () => {
  test("constructor accepts provider and toolBus", () => {
    const provider = { chat: mock(() => Promise.resolve({ text: "ok", tool_calls: [] })) };
    const toolBus = { execute: mock(() => Promise.resolve({ success: true, output: "done" })) };
    const executor = new ToolLoopExecutor(provider, toolBus);
    expect(executor).toBeDefined();
  });

  test("execute returns response with iterations for simple task", async () => {
    const provider = {
      chat: mock(() =>
        Promise.resolve({ text: "The answer is 4", tool_calls: [] }),
      ),
    };
    const toolBus = { execute: mock() };
    const executor = new ToolLoopExecutor(provider, toolBus);
    const result = await executor.execute("What is 2+2?", []);
    expect(result.response.text).toBe("The answer is 4");
    expect(result.iterations).toBe(1);
    expect(result.response.tool_calls).toEqual([]);
  });

  test("execute runs tool loop then returns", async () => {
    let callCount = 0;
    const provider = {
      chat: mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            text: "",
            tool_calls: [{ id: "tc1", name: "echo", arguments: { text: "hi" } }],
          });
        }
        return Promise.resolve({ text: "done", tool_calls: [] });
      }),
    };
    const toolBus = {
      execute: mock(() => Promise.resolve({ success: true, output: "hi" })),
    };
    const executor = new ToolLoopExecutor(provider, toolBus);
    const result = await executor.execute("say hi", [{ name: "echo", description: "", parameters: {} }]);
    expect(result.iterations).toBe(2);
    expect(result.response.text).toBe("done");
    expect(toolBus.execute).toHaveBeenCalledTimes(1);
  });

  test("execute handles tool errors gracefully", async () => {
    let callCount = 0;
    const provider = {
      chat: mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            text: "",
            tool_calls: [{ id: "tc1", name: "fail", arguments: {} }],
          });
        }
        return Promise.resolve({ text: "recovered", tool_calls: [] });
      }),
    };
    const toolBus = {
      execute: mock(() => Promise.resolve({ success: false, error: "boom" })),
    };
    const executor = new ToolLoopExecutor(provider, toolBus);
    const result = await executor.execute("do something", []);
    expect(result.response.text).toBe("recovered");
    expect(result.iterations).toBe(2);
  });

  test("execute respects maxIterations", async () => {
    const provider = {
      chat: mock(() =>
        Promise.resolve({
          text: "",
          tool_calls: [{ id: "tc1", name: "loop", arguments: {} }],
        }),
      ),
    };
    const toolBus = {
      execute: mock(() => Promise.resolve({ success: true, output: "ok" })),
    };
    const executor = new ToolLoopExecutor(provider, toolBus);
    const result = await executor.execute("infinite loop", [], 3);
    expect(result.iterations).toBe(3);
  });
});
