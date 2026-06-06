import { test, describe, expect, beforeEach } from "bun:test";
import { ToolMetricsCollector } from "../../../src/agent/tools/metrics";

describe("ToolMetricsCollector", () => {
  let collector: ToolMetricsCollector;

  beforeEach(() => {
    collector = new ToolMetricsCollector();
  });

  test("getMetrics returns null for unrecorded tool", () => {
    expect(collector.getMetrics("unknown")).toBeNull();
  });

  test("record tracks a single call", () => {
    collector.record("tool_a", 100, true);
    const m = collector.getMetrics("tool_a");
    expect(m).not.toBeNull();
    expect(m!.calls).toBe(1);
    expect(m!.successes).toBe(1);
    expect(m!.failures).toBe(0);
    expect(m!.avgMs).toBe(100);
  });

  test("record tracks multiple calls and computes avgMs", () => {
    collector.record("tool_a", 100, true);
    collector.record("tool_a", 200, true);
    collector.record("tool_a", 50, false);
    const m = collector.getMetrics("tool_a")!;
    expect(m.calls).toBe(3);
    expect(m.successes).toBe(2);
    expect(m.failures).toBe(1);
    expect(m.avgMs).toBeCloseTo(116.666, 1);
  });

  test("getAllMetrics returns all tools", () => {
    collector.record("t1", 10, true);
    collector.record("t2", 20, false);
    const all = collector.getAllMetrics();
    expect(Object.keys(all).sort()).toEqual(["t1", "t2"]);
    expect(all.t1.calls).toBe(1);
    expect(all.t2.calls).toBe(1);
    expect(all.t2.failures).toBe(1);
  });

  test("reset clears all metrics", () => {
    collector.record("tool_a", 50, true);
    collector.reset();
    expect(collector.getMetrics("tool_a")).toBeNull();
    expect(Object.keys(collector.getAllMetrics()).length).toBe(0);
  });

  test("tracks failures correctly", () => {
    collector.record("tool_a", 100, false);
    const m = collector.getMetrics("tool_a")!;
    expect(m.failures).toBe(1);
    expect(m.successes).toBe(0);
  });
});
