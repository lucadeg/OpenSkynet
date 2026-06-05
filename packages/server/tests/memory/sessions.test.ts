import { test, describe, expect, beforeEach, afterEach } from "bun:test";
import { tmpSedimanDir } from "../fixtures";
import { resetConfig } from "../../src/core/config";
import { closeDb, getDb } from "../../src/store/db";

describe("sessions", () => {
  let dir: string;
  let cleanup: () => void;

  beforeEach(async () => {
    ({ dir, cleanup } = tmpSedimanDir());
    process.env.SEDIMAN_DATA_DIR = dir;
    resetConfig();
    closeDb();
    await import("../../src/memory/sessions");
  });

  afterEach(() => {
    closeDb();
    cleanup();
    delete process.env.SEDIMAN_DATA_DIR;
    resetConfig();
  });

  test("saveSession returns id", async () => {
    const { saveSession } = await import("../../src/memory/sessions");
    const id = await saveSession({ task: "test session task" });
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  test("getRecentSessions returns array", async () => {
    const { saveSession, getRecentSessions } = await import("../../src/memory/sessions");
    await saveSession({ task: "session one" });
    await saveSession({ task: "session two" });

    const sessions = await getRecentSessions();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions[0].task).toBeTruthy();
  });

  test("searchSessions finds by keyword", async () => {
    const { saveSession, searchSessions } = await import("../../src/memory/sessions");
    await saveSession({ task: "deploy application to production", result: "success" });

    const results = await searchSessions("production");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("deleteSession removes session", async () => {
    const { saveSession, deleteSession, getSessionById } = await import("../../src/memory/sessions");
    const id = await saveSession({ task: "to be deleted" });

    const deleted = await deleteSession(id);
    expect(deleted).toBe(true);

    const fetched = await getSessionById(id);
    expect(fetched).toBeNull();
  });

  test("getSessionById returns null for unknown id", async () => {
    const { getSessionById } = await import("../../src/memory/sessions");
    const result = await getSessionById("nonexistent-id");
    expect(result).toBeNull();
  });
});
