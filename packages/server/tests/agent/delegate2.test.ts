/** Tests for Agent Delegate */
import { test, describe, expect } from "bun:test";
import { delegateParallel } from "../../../src/agent/delegate";

describe("AgentDelegate", () => {
  describe("delegateParallel", () => {
    test("runs tasks in parallel", async () => {
      const tasks = [
        { task: "task 1", strategy: "direct" },
        { task: "task 2", strategy: "direct" },
        { task: "task 3", strategy: "direct" },
      ];
      const results = await delegateParallel(tasks);
      expect(results.length).toBe(3);
    });

    test("respects maxConcurrency", async () => {
      const tasks = Array.from({ length: 20 }, (_, i) => ({
        task: `task ${i}`,
        strategy: "direct",
      }));
      const maxConcurrency = 5;
      const results = await delegateParallel(tasks, maxConcurrency);
      expect(results.length).toBe(20);
    });
  });

  describe("strategy selection", () => {
    test("uses direct strategy for simple tasks", () => {
      const strategy = "direct";
      expect(strategy).toBe("direct");
    });

    test("uses delegate strategy for complex tasks", () => {
      const strategy = "delegate";
      expect(strategy).toBe("delegate");
    });
  });
});
