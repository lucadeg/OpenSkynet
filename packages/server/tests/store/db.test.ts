import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { tmpSedimanDir } from "../fixtures";
import { resetConfig } from "../../src/core/config";
import { closeDb } from "../../src/store/db";

describe("database", () => {
  let dir: string;
  let cleanup: () => void;
  let db: import("bun:sqlite").Database;

  beforeEach(async () => {
    ({ dir, cleanup } = tmpSedimanDir());
    process.env.SEDIMAN_DATA_DIR = dir;
    resetConfig();
    closeDb();
    const mod = await import("../../src/store/db");
    db = mod.initDb();
  });

  afterEach(() => {
    try { db.close(); } catch {}
    closeDb();
    cleanup();
    delete process.env.SEDIMAN_DATA_DIR;
    resetConfig();
  });

  test("initDb creates tables", () => {
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain("sessions");
    expect(names).toContain("session_steps");
    expect(names).toContain("trajectories");
    expect(names).toContain("trajectory_preferences");
  });

  test("sessions can be inserted and queried", () => {
    db.run(
      "INSERT INTO sessions (id, task, steps_json) VALUES (?, ?, ?)",
      "sess-1",
      "test task",
      "[]",
    );
    const row = db
      .query("SELECT * FROM sessions WHERE id = ?")
      .get("sess-1") as any;
    expect(row.id).toBe("sess-1");
    expect(row.task).toBe("test task");
  });

  test("trajectories can be inserted and queried", () => {
    db.run(
      "INSERT INTO trajectories (id, task, steps_json, success) VALUES (?, ?, ?, ?)",
      "traj-1",
      "do something",
      "[]",
      1,
    );
    const row = db
      .query("SELECT * FROM trajectories WHERE id = ?")
      .get("traj-1") as any;
    expect(row.id).toBe("traj-1");
    expect(row.success).toBe(1);
  });

  test("FTS5 search works", () => {
    db.run(
      "INSERT INTO sessions (id, task, steps_json, result) VALUES (?, ?, ?, ?)",
      "sess-fts",
      "deploy the application to production",
      "[]",
      "deployment complete",
    );

    const rows = db
      .query(
        "SELECT s.id, s.task FROM sessions s JOIN sessions_fts f ON s.id = f.id WHERE sessions_fts MATCH ?",
      )
      .all("deployment") as Array<{ id: string; task: string }>;

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.id === "sess-fts")).toBe(true);
  });
});
