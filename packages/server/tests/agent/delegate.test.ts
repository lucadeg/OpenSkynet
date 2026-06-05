import { test, describe, expect } from "bun:test";
import { delegateParallel } from "../../src/agent/delegate";

describe("delegateParallel", () => {
  test("runs tasks and returns results", async () => {
    const tasks = [
      { task: "task A", strategy: "direct" },
      { task: "task B", strategy: "delegate" },
    ];
    const results = await delegateParallel(tasks);
    expect(results.length).toBe(2);
    expect(results[0].task).toBe("task A");
    expect(results[0].success).toBe(true);
    expect(results[0].result).toContain("[direct] executed: task A");
  });

  test("respects maxConcurrency", async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      task: `task-${i}`,
      strategy: "direct",
    }));
    const results = await delegateParallel(tasks, { maxConcurrency: 3 });
    expect(results.length).toBe(10);
    for (const r of results) {
      expect(r.success).toBe(true);
    }
  });

  test("handles single task", async () => {
    const results = await delegateParallel([{ task: "only one", strategy: "direct" }]);
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
  });

  test("handles empty task list", async () => {
    const results = await delegateParallel([]);
    expect(results).toEqual([]);
  });
});
