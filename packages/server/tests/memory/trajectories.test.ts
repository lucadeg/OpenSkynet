import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { tmpSedimanDir } from "../fixtures";
import { resetConfig } from "../../src/core/config";
import { closeDb } from "../../src/store/db";
import type { TrajectoryDB } from "../../src/memory/trajectories";

describe("TrajectoryDB", () => {
  let dir: string;
  let cleanup: () => void;
  let db: TrajectoryDB;

  beforeEach(async () => {
    ({ dir, cleanup } = tmpSedimanDir());
    process.env.SEDIMAN_DATA_DIR = dir;
    resetConfig();
    closeDb();
    const mod = await import("../../src/memory/trajectories");
    db = new mod.TrajectoryDB();
  });

  afterEach(() => {
    closeDb();
    cleanup();
    delete process.env.SEDIMAN_DATA_DIR;
    resetConfig();
  });

  test("save and getById", async () => {
    const saved = await db.save({
      task: "deploy to production",
      steps: [{ action: "run deploy script", observation: "deployed" }],
      success: true,
      result: "deployed successfully",
    });
    expect(saved.id).toBeTruthy();
    expect(saved.task).toBe("deploy to production");

    const fetched = await db.getById(saved.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.task).toBe("deploy to production");
    expect(fetched!.success).toBe(true);
  });

  test("getByTask finds matching trajectories", async () => {
    await db.save({ task: "deploy staging", steps: [], success: true });
    await db.save({ task: "deploy production", steps: [], success: true });
    await db.save({ task: "run tests", steps: [], success: false });

    const results = await db.getByTask("deploy");
    expect(results.length).toBe(2);
    for (const r of results) {
      expect(r.task).toContain("deploy");
    }
  });

  test("getSuccessful returns only successful trajectories", async () => {
    await db.save({ task: "task a", steps: [], success: true });
    await db.save({ task: "task b", steps: [], success: false });
    await db.save({ task: "task c", steps: [], success: true });

    const results = await db.getSuccessful();
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.length).toBe(2);
  });

  test("addPreference and getPreferences", async () => {
    const traj = await db.save({ task: "test task", steps: [], success: true });
    await db.addPreference(traj.id, 1, "great result");
    await db.addPreference(traj.id, -1, "could be better");

    const prefs = await db.getPreferences(traj.id);
    expect(prefs.length).toBe(2);
    expect(prefs.map((p) => p.rating).sort()).toEqual([-1, 1]);
  });

  test("getStats returns correct counts", async () => {
    await db.save({ task: "s1", steps: [], success: true });
    await db.save({ task: "s2", steps: [], success: true });
    await db.save({ task: "s3", steps: [], success: false });

    const stats = await db.getStats();
    expect(stats.total).toBe(3);
    expect(stats.successful).toBe(2);
    expect(stats.failed).toBe(1);
  });
});
