import { test, describe, expect } from "bun:test";
import { Changelog } from "../../src/memory/utils/changelog";

describe("Changelog", () => {
  test("addChange and getRecentChanges", () => {
    const cl = new Changelog();
    cl.addChange("add", "memory", "new fact about user");
    cl.addChange("update", "memory", "updated preference");

    const changes = cl.getRecentChanges();
    expect(changes.length).toBe(2);
    expect(changes[0].action).toBe("update");
    expect(changes[0].target).toBe("memory");
  });

  test("filter by target", () => {
    const cl = new Changelog();
    cl.addChange("add", "memory", "fact one");
    cl.addChange("add", "user", "preference one");
    cl.addChange("update", "memory", "fact two");

    const memoryChanges = cl.getRecentChanges("memory");
    expect(memoryChanges.length).toBe(2);
    expect(memoryChanges.every((c) => c.target === "memory")).toBe(true);
  });

  test("respect limit", () => {
    const cl = new Changelog();
    for (let i = 0; i < 20; i++) {
      cl.addChange("add", "memory", `entry ${i}`);
    }

    const limited = cl.getRecentChanges(undefined, 5);
    expect(limited.length).toBe(5);
  });

  test("respects maxEntries", () => {
    const cl = new Changelog(5);
    for (let i = 0; i < 10; i++) {
      cl.addChange("add", "memory", `entry ${i}`);
    }
    const all = cl.getRecentChanges(undefined, 100);
    expect(all.length).toBe(5);
  });

  test("entries have timestamps", () => {
    const cl = new Changelog();
    cl.addChange("add", "memory", "test");
    const changes = cl.getRecentChanges();
    expect(changes[0].timestamp).toBeTruthy();
    expect(new Date(changes[0].timestamp).getTime()).not.toBeNaN();
  });
});
