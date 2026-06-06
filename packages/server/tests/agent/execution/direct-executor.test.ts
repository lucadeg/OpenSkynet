import { test, describe, expect, mock } from "bun:test";
import { DirectExecutor } from "../../../src/agent/execution/direct-executor";

describe("DirectExecutor", () => {
  test("constructor accepts provider and toolBus", () => {
    const provider = { chat: mock(() => Promise.resolve({ text: "ok", tool_calls: [] })) };
    const toolBus = { execute: mock(), getDefinitions: mock(() => []) };
    const executor = new DirectExecutor(provider, toolBus);
    expect(executor).toBeDefined();
  });

  test("execute returns result without tools", async () => {
    const provider = {
      chat: mock(() =>
        Promise.resolve({ text: "42", tool_calls: [] }),
      ),
    };
    const toolBus = { execute: mock(), getDefinitions: mock(() => []) };
    const executor = new DirectExecutor(provider, toolBus);
    const result = await executor.execute("What is 6*7?");
    expect(result.success).toBe(true);
    expect(result.result).toBe("42");
    expect(result.strategy_used).toBe("direct");
    expect(result.iterations).toBe(1);
    expect(result.steps).toEqual([]);
  });

  test("execute runs tool calls and collects steps", async () => {
    let callCount = 0;
    const provider = {
      chat: mock(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            text: "",
            tool_calls: [{ id: "tc1", name: "calc", arguments: { expr: "2+2" } }],
          });
        }
        return Promise.resolve({ text: "4", tool_calls: [] });
      }),
    };
    const toolBus = {
      execute: mock(() => Promise.resolve({ success: true, output: "4" })),
      getDefinitions: mock(() => []),
    };
    const executor = new DirectExecutor(provider, toolBus);
    const result = await executor.execute("Calculate 2+2");
    expect(result.success).toBe(true);
    expect(result.result).toBe("4");
    expect(result.steps.length).toBe(1);
    expect(result.steps[0].action).toBe("calc");
    expect(result.actions_taken).toEqual(["calc"]);
  });

  test("execute with systemPrompt passes it to provider", async () => {
    const provider = {
      chat: mock(() =>
        Promise.resolve({ text: "hello", tool_calls: [] }),
      ),
    };
    const toolBus = { execute: mock(), getDefinitions: mock(() => []) };
    const executor = new DirectExecutor(provider, toolBus);
    await executor.execute("hi", "You are helpful");
    expect(provider.chat).toHaveBeenCalledTimes(1);
    const callArgs = provider.chat.mock.calls[0];
    expect(callArgs[2]).toBe("You are helpful");
  });
});
