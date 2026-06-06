import { test, describe, expect } from "bun:test";
import { BackgroundTaskManager } from "../../../src/agent/loop-modules/background-task-manager";

describe("BackgroundTaskManager", () => {
  test("submit runs task", async () => {
    const mgr = new BackgroundTaskManager();
    let executed = false;
    mgr.submit(async () => {
      executed = true;
    });
    await mgr.waitForAll();
    expect(executed).toBe(true);
  });

  test("waitForAll waits for completion", async () => {
    const mgr = new BackgroundTaskManager();
    const order: number[] = [];
    mgr.submit(async () => {
      order.push(1);
    });
    mgr.submit(async () => {
      order.push(2);
    });
    await mgr.waitForAll();
    expect(order.length).toBe(2);
    expect(order).toContain(1);
    expect(order).toContain(2);
  });

  test("cancelAll cancels pending tasks", async () => {
    const mgr = new BackgroundTaskManager();
    let cancelled = false;
    mgr.submit(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    });
    mgr.cancelAll();
    const tasks = (mgr as any).tasks as Array<{ promise: Promise<void> }>;
    expect(tasks.length).toBe(0);
  });

  test("waitForAll clears task list after completion", async () => {
    const mgr = new BackgroundTaskManager();
    mgr.submit(async () => {});
    await mgr.waitForAll();
    expect((mgr as any).tasks.length).toBe(0);
  });

  test("handles multiple sequential waitForAll calls", async () => {
    const mgr = new BackgroundTaskManager();
    let count = 0;
    mgr.submit(async () => { count++; });
    await mgr.waitForAll();
    expect(count).toBe(1);
    mgr.submit(async () => { count++; });
    await mgr.waitForAll();
    expect(count).toBe(2);
  });
});
